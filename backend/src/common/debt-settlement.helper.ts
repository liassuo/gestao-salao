import { computeRenewalCycle } from './subscription-cycle.util';
import { localDateString, nowLocalIsoString } from './datetime.util';

/**
 * Baixa de pagamento de dívida (cobrança "Quitação de dívida" do
 * createPixChargeForDebts, externalReference = clientId): quita as dívidas do
 * cliente e, se entre elas havia a mensalidade de uma assinatura encerrada
 * ('Cobrança não paga'), REATIVA a assinatura.
 *
 * Fonte única para o webhook (PAYMENT_RECEIVED/CONFIRMED) e para o botão
 * "Confirmar pagamento" da central de reconciliação — antes o botão registrava
 * o pagamento de dívida mas caía em "sem vínculo" e não quitava nada (caso
 * Paulo Sergio, 16/07/2026).
 *
 * IDEMPOTENTE — pode rodar mais de uma vez:
 *  - só quita dívida ainda aberta (isSettled=false);
 *  - só reativa assinatura ainda SUSPENDED (filtro na escrita).
 *
 * BLINDAGENS (espelham o resto do fluxo, e foram o que a revisão exigiu):
 *  - cobertura: só quita se o valor pago cobre o total pendente (senão a dívida fica);
 *  - vínculo: só reativa assinatura se havia dívida 'Cobrança não paga' entre as pagas
 *    (pagar uma dívida avulsa de comanda NÃO reativa assinatura de graça);
 *  - liquidação ao vivo: só reativa se isChargeSettled confirma o pagamento no Asaas;
 *  - reativa ANTES de quitar e ABORTA a quitação se a reativação falhar — assim nunca
 *    fica SEM-dívida-e-Encerrado (o bug original); no pior caso fica ATIVO-com-dívida.
 */
/** Recorte do AsaasService que a limpeza pós-reativação usa. */
export interface AsaasChargeCleanupApi {
  configured: boolean;
  cancelCharge: (asaasPaymentId: string) => Promise<unknown>;
  getSubscriptionPayments: (asaasSubscriptionId: string) => Promise<any[]>;
  updateSubscription: (
    asaasSubscriptionId: string,
    payload: { nextDueDate: string },
  ) => Promise<unknown>;
}

export interface DebtSettlementDeps {
  supabase: { from: (table: string) => any };
  logger: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  /** Confirma no Asaas (fonte da verdade) que a cobrança está liquidada. */
  isChargeSettled: (asaasPaymentId: string) => Promise<boolean>;
  /**
   * Quando presente, a quitação também cancela no Asaas as faturas da
   * recorrência que ficaram redundantes com a reativação (mesma blindagem que o
   * balcão ganhou no fluxo confirmPaymentManually) — sem isso o gateway segue
   * cobrando o ciclo recém-pago (casos Leandro Belo / Gustavo Parreira /
   * Gabriel Marra, 30/07/2026).
   */
  asaas?: AsaasChargeCleanupApi;
}

export interface DebtSettlementResult {
  /** Dívidas efetivamente quitadas nesta chamada. */
  settledCount: number;
  /** Alguma assinatura SUSPENDED foi reativada. */
  reactivated: boolean;
}

/** Rótulo exclusivo das dívidas de MENSALIDADE (criadas ao suspender por vencimento). */
export function isSubscriptionDelinquencyDebt(description?: string | null): boolean {
  return /^Cobrança não paga/i.test(description || '');
}

/**
 * Extrai o id da assinatura da tag `[sub:<uuid>:cycle:<data>]` que acompanha a
 * descrição da dívida de mensalidade (ver createSubscriptionDelinquencyDebt).
 */
export function parseSubscriptionIdFromDebtDescription(
  description?: string | null,
): string | null {
  const m = /\[sub:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/.exec(
    description || '',
  );
  return m ? m[1] : null;
}

/**
 * Assinatura à qual uma dívida de mensalidade se refere. Preferência pela tag
 * `[sub:...]`; dívida LEGADO (sem tag) só resolve quando o cliente tem
 * exatamente UMA assinatura suspensa — com duas, não dá para adivinhar qual o
 * pagamento cobre, e reativar a errada daria mês grátis.
 */
export async function resolveSubscriptionForDelinquencyDebt(
  supabase: { from: (t: string) => any },
  clientId: string,
  description?: string | null,
): Promise<string | null> {
  if (!isSubscriptionDelinquencyDebt(description)) return null;

  const tagged = parseSubscriptionIdFromDebtDescription(description);
  if (tagged) return tagged;

  const { data: suspended } = await supabase
    .from('client_subscriptions')
    .select('id')
    .eq('clientId', clientId)
    .eq('status', 'SUSPENDED');
  return (suspended || []).length === 1 ? (suspended as any[])[0].id : null;
}

/**
 * Reativa a assinatura cuja mensalidade acabou de ser quitada NO BALCÃO (botão
 * "quitar" da tela de dívidas — dinheiro/cartão na mão, sem cobrança Asaas).
 *
 * Por que existe: settleDebt quitava a dívida, lançava o caixa e limpava
 * hasDebts, mas deixava a assinatura SUSPENDED — o cliente ficava
 * "sem-dívida-e-encerrado", estado que nenhuma reconciliação recupera (a dívida,
 * que era a prova, sumiu) e que volta a cobrar o corte dele.
 *
 * GUARDAS:
 *  - só assinatura ainda SUSPENDED (filtro na escrita = idempotente);
 *  - só se NÃO sobrar nenhuma outra mensalidade em aberto do cliente — quem deve
 *    2 meses e paga 1 não volta a ficar em dia (anti-mês-grátis);
 *  - dia-âncora: preserva o dia do vencimento (isRenewal=true — SUSPENDED implica
 *    ciclo anterior existente).
 *
 * Chame DEPOIS de quitar a dívida (a régua de "outra em aberto" conta o estado já
 * quitado) e DEPOIS de vincular o pagamento à assinatura (senão a assinatura volta
 * ACTIVE porém com "ciclo não pago", e o corte segue sendo cobrado).
 */
export async function reactivateSubscriptionForSettledDebt(
  deps: Pick<DebtSettlementDeps, 'supabase' | 'logger'>,
  clientId: string,
  subscriptionId: string,
): Promise<boolean> {
  const { supabase, logger } = deps;

  const { data: openDelinquency } = await supabase
    .from('debts')
    .select('id')
    .eq('clientId', clientId)
    .eq('isSettled', false)
    .ilike('description', 'Cobrança não paga%');

  if ((openDelinquency || []).length > 0) {
    logger.warn(
      `Assinatura ${subscriptionId} NÃO reativada: cliente ${clientId} ainda tem ` +
      `${(openDelinquency as any[]).length} mensalidade(s) em aberto (quitar todas para voltar a ficar em dia).`,
    );
    return false;
  }

  const { data: sub } = await supabase
    .from('client_subscriptions')
    .select('id, status, endDate')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!sub || (sub as any).status !== 'SUSPENDED') return false;

  const now = new Date();
  const cycle = computeRenewalCycle({
    prevEndDate: (sub as any).endDate,
    refDate: now,
    isRenewal: true,
  });

  const { error } = await supabase
    .from('client_subscriptions')
    .update({
      status: 'ACTIVE',
      cutsUsedThisMonth: 0,
      lastResetDate: now.toISOString(),
      ...(cycle.startDate ? { startDate: cycle.startDate.toISOString() } : {}),
      endDate: cycle.endDate.toISOString(),
      isComp: false, // houve pagamento real → não é cortesia
      updatedAt: now.toISOString(),
    })
    .eq('id', subscriptionId)
    .eq('status', 'SUSPENDED'); // idempotência

  if (error) {
    logger.error(
      `Falha ao reativar assinatura ${subscriptionId} após quitação manual da dívida: ${error.message}. ` +
      `Reative pela tela de assinaturas.`,
    );
    return false;
  }

  logger.log(
    `Assinatura ${subscriptionId} REATIVADA até ${cycle.endDate.toISOString()} após quitação da mensalidade no balcão.`,
  );
  return true;
}

export async function settleDebtPaymentAndReactivate(
  deps: DebtSettlementDeps,
  clientId: string,
  paidAmount: number,
  asaasPaymentId: string,
): Promise<DebtSettlementResult> {
  const { supabase, logger, isChargeSettled } = deps;
  const debtNow = nowLocalIsoString();
  const result: DebtSettlementResult = { settledCount: 0, reactivated: false };
  // Assinatura que este pagamento cobre — para VINCULAR o payment espelho no
  // final (isCurrentCyclePaid filtra por subscriptionId; sem o vínculo a tela
  // de agendamento seguia dizendo "ciclo não pago" mesmo com a assinatura
  // reativada, e o admin confirmava manualmente de novo → payment duplicado no
  // caixa — caso Roger lima, 22/07/2026).
  let linkedSubscriptionId: string | null = null;
  // Ciclos reativados nesta chamada — no final, as faturas da recorrência que
  // esta quitação tornou redundantes são canceladas no Asaas (nunca antes da
  // baixa: falha de gateway não pode abortar quitação/reativação já decididas).
  const reactivatedCycles: Array<{
    subscriptionId: string;
    paidCycleEndDay: string;
    newCycleEndDay: string;
  }> = [];

  const { data: pendingDebts } = await supabase
    .from('debts')
    .select('id, amount, remainingBalance, description')
    .eq('clientId', clientId)
    .eq('isSettled', false);

  const totalPending = (pendingDebts || []).reduce(
    (sum: number, d: any) => sum + (d.remainingBalance ?? d.amount),
    0,
  );

  // Cobertura: se o pagamento não cobre o pendente, NÃO quita (deixa a dívida).
  // Aborta inclusive a reativação — não destrava assinatura sem o ciclo pago.
  if (totalPending > 0 && paidAmount < totalPending) {
    logger.warn(
      `Pagamento de dívida insuficiente para cliente ${clientId}: ` +
      `pago ${paidAmount}, total pendente atual ${totalPending}. Dívidas não quitadas, assinatura não reativada.`,
    );
    return result;
  }

  // Houve dívida de ASSINATURA paga por este fluxo? Só conta a que está ABERTA agora
  // (rótulo exclusivo 'Cobrança não paga'). Dívida avulsa (comanda/manual) não usa
  // esse rótulo → pagá-la não reativa assinatura de graça.
  //
  // NOTA DE PROJETO (não é furo): o caso de REENTREGA em que a 1ª entrega já quitou a
  // dívida (pendingDebts vazio) NÃO é auto-curado aqui de propósito. Tentar detectá-lo
  // por "qualquer dívida de assinatura já quitada do cliente" reativava de graça quem
  // pagou um ciclo antigo (verificação adversarial 2026-06-15). Esse caso — raro, exige
  // o webhook falhar exatamente entre quitar e reativar — é coberto pelo script
  // reconcile-suspended-paid-debts.mjs, que correlaciona a prova com a dívida no Asaas.
  const hadSubscriptionDebt = (pendingDebts || []).some((d: any) =>
    /^Cobrança não paga/i.test(d.description || ''),
  );

  // REATIVAR ANTES de quitar. Reativar é idempotente (filtro SUSPENDED) e reversível;
  // quitar é a operação que "perde a cobrança". Se a quitação falhar depois, o pior
  // estado é ATIVO-com-dívida-visível (recuperável) em vez de SEM-dívida-e-Encerrado
  // (que era o bug original). Só reativa com dívida de assinatura + liquidação ao vivo.
  if (hadSubscriptionDebt) {
    const debtSettled = await isChargeSettled(asaasPaymentId);
    if (!debtSettled) {
      logger.warn(
        `Pagamento de dívida ${asaasPaymentId}: cobrança não liquidada no Asaas — assinatura NÃO reativada (evita reativar sem pagamento real).`,
      );
      return result; // sem liquidação confirmada não quita nem reativa
    }

    const { data: suspendedSubs } = await supabase
      .from('client_subscriptions')
      .select('id, endDate')
      .eq('clientId', clientId)
      .eq('status', 'SUSPENDED')
      .order('createdAt', { ascending: false });

    for (const susp of suspendedSubs || []) {
      const reactNow = new Date();
      // Capturado ANTES do update — é o vencimento do ciclo que a dívida cobrava.
      const paidCycleEndDay = String((susp as any).endDate || '').substring(0, 10);
      // Dia-âncora: a dívida paga é a mensalidade do ciclo que venceu em endDate.
      // Pagou dentro da carência → o vencimento mantém o dia (isRenewal sempre
      // true aqui: SUSPENDED implica ciclo anterior existente).
      const cycle = computeRenewalCycle({
        prevEndDate: (susp as any).endDate,
        refDate: reactNow,
        isRenewal: true,
      });

      const { error: reactError } = await supabase
        .from('client_subscriptions')
        .update({
          status: 'ACTIVE',
          cutsUsedThisMonth: 0,
          lastResetDate: reactNow.toISOString(),
          ...(cycle.startDate ? { startDate: cycle.startDate.toISOString() } : {}),
          endDate: cycle.endDate.toISOString(),
          updatedAt: reactNow.toISOString(),
        })
        .eq('id', susp.id)
        .eq('status', 'SUSPENDED'); // idempotência

      // Se a reativação falhar, NÃO quita a dívida: deixar a dívida em aberto mantém
      // o cliente "Encerrado-COM-dívida" (recuperável: ele paga de novo ou o script
      // reconcilia) em vez de "Encerrado-SEM-dívida" (irrecuperável — a carga some).
      if (reactError) {
        logger.error(
          `Falha ao reativar assinatura ${susp.id} (cobrança ${asaasPaymentId}): ${reactError.message}. ` +
          `Dívida NÃO será quitada para preservar a cobrança; reconciliação cobre depois.`,
        );
        return result;
      }

      result.reactivated = true;
      if (!linkedSubscriptionId) linkedSubscriptionId = (susp as any).id;
      reactivatedCycles.push({
        subscriptionId: (susp as any).id,
        paidCycleEndDay,
        newCycleEndDay: localDateString(cycle.endDate),
      });
      logger.log(
        `Assinatura ${susp.id} REATIVADA após quitação de dívida via PIX (cobrança ${asaasPaymentId}).`,
      );
    }
  }

  // Agora quita as dívidas em aberto (idempotente: só toca isSettled=false).
  for (const debt of pendingDebts || []) {
    await supabase
      .from('debts')
      .update({
        amountPaid: debt.amount,
        remainingBalance: 0,
        isSettled: true,
        paidAt: debtNow,
      })
      .eq('id', debt.id)
      .eq('isSettled', false);
    result.settledCount += 1;
  }

  // Recalcula hasDebts em vez de forçar false (pode ter sobrado dívida de outra
  // natureza — embora o guard de cobertura acima torne isso raro).
  const { count: remainingCount } = await supabase
    .from('debts')
    .select('id', { count: 'exact', head: true })
    .eq('clientId', clientId)
    .eq('isSettled', false);
  await supabase
    .from('clients')
    .update({ hasDebts: (remainingCount || 0) > 0 })
    .eq('id', clientId);

  if ((pendingDebts || []).length > 0) {
    logger.log(
      `Dívidas do cliente ${clientId} quitadas via PIX (${pendingDebts!.length} dívida(s)).`,
    );
  }

  // Vincula o payment espelho desta cobrança à assinatura coberta. Sem sub
  // reativada nesta chamada (ex.: já estava ACTIVE por reentrega/idempotência),
  // resolve pela tag [sub:...] da dívida de mensalidade quitada.
  if (!linkedSubscriptionId) {
    for (const d of pendingDebts || []) {
      if (!isSubscriptionDelinquencyDebt((d as any).description)) continue;
      linkedSubscriptionId = parseSubscriptionIdFromDebtDescription((d as any).description);
      if (linkedSubscriptionId) break;
    }
  }
  if (linkedSubscriptionId && (result.settledCount > 0 || result.reactivated)) {
    const { error: linkError } = await supabase
      .from('payments')
      .update({ subscriptionId: linkedSubscriptionId, updatedAt: debtNow })
      .eq('asaasPaymentId', asaasPaymentId)
      .is('subscriptionId', null);
    if (linkError) {
      logger.warn(
        `Falha ao vincular payment da cobrança ${asaasPaymentId} à assinatura ${linkedSubscriptionId}: ${linkError.message}`,
      );
    } else {
      logger.log(
        `Payment da cobrança ${asaasPaymentId} vinculado à assinatura ${linkedSubscriptionId} (ciclo pago visível).`,
      );
    }
  }

  // Por último — a quitação e a reativação já valem; a limpeza de faturas é
  // melhor-esforço e nunca as desfaz.
  if (deps.asaas) {
    for (const cycleInfo of reactivatedCycles) {
      await cancelRecurrenceChargesSupersededByReactivation(
        { supabase, logger, asaas: deps.asaas },
        cycleInfo,
      );
    }
  }

  return result;
}

/**
 * Cancela no Asaas as faturas da RECORRÊNCIA que a reativação por quitação de
 * dívida tornou redundantes. Espelho do que o balcão faz via
 * cancelPendingAsaasChargesForSubscription (PR #49) — sem isso a fatura OVERDUE
 * do ciclo recém-pago fica aberta no gateway, cobrando o cliente por
 * e-mail/lembrete de PIX até ele pagar o MESMO ciclo duas vezes (casos Leandro
 * Belo / Gustavo Parreira / Gabriel Marra, 30/07/2026).
 *
 * Régua: o ciclo está pago até `newCycleEndDay` — toda fatura em aberto que
 * vence ANTES dele é redundante e morre; a que vence NELE ou depois é a
 * cobrança legítima do próximo ciclo e sobrevive.
 *
 * Dia-âncora: pagar além da carência MOVE o dia do ciclo (ex.: venceu dia 15,
 * quitou dia 23 → novo ciclo 23→23), mas a recorrência Asaas continua gerando
 * fatura no dia antigo — no MEIO do ciclo pago, todo mês (o guard do OVERDUE
 * até cancela cada uma, mas só no vencimento, depois de dias cobrando o
 * cliente). Quando uma fatura dessas (vencimento entre o ciclo antigo e o novo)
 * é cancelada aqui, o nextDueDate da recorrência é realinhado ao fim do novo
 * ciclo. Só nesse caso: antecipar o nextDueDate com a fatura legítima ainda
 * viva geraria cobrança duplicada.
 *
 * NUNCA lança — falha vira warn com instrução de conferência manual.
 */
export async function cancelRecurrenceChargesSupersededByReactivation(
  deps: Pick<DebtSettlementDeps, 'supabase' | 'logger'> & { asaas: AsaasChargeCleanupApi },
  info: { subscriptionId: string; paidCycleEndDay: string; newCycleEndDay: string },
): Promise<void> {
  const { supabase, logger, asaas } = deps;
  if (!asaas.configured) return;

  try {
    const { data: subRow } = await supabase
      .from('client_subscriptions')
      .select('asaasSubscriptionId')
      .eq('id', info.subscriptionId)
      .maybeSingle();
    const asaasSubId = (subRow as any)?.asaasSubscriptionId;
    if (!asaasSubId) return;

    let charges: any[] = [];
    try {
      charges = (await asaas.getSubscriptionPayments(asaasSubId)) || [];
    } catch (e: any) {
      logger.warn(
        `Assinatura ${info.subscriptionId}: falha ao listar faturas da recorrência ${asaasSubId} (${e?.message}) — ` +
        `a fatura do ciclo recém-quitado pode seguir aberta no Asaas; conferir manualmente.`,
      );
      return;
    }

    const OPEN = ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'];
    let canceledDriftedInvoice = false;
    for (const c of charges) {
      // Nunca tocar em cobrança paga/estornada — só as que seguem cobrando.
      if (!OPEN.includes(c?.status) || c?.deleted || c?.paymentDate) continue;
      const dueDay = String(c?.dueDate || '').substring(0, 10);
      if (!dueDay || dueDay >= info.newCycleEndDay) continue; // próximo ciclo: preservar

      try {
        await asaas.cancelCharge(c.id);
        // Espelho, se existir (fatura já reconciliada antes), deixa de constar pendente.
        await supabase
          .from('payments')
          .update({ asaasStatus: 'CANCELED', updatedAt: nowLocalIsoString() })
          .eq('asaasPaymentId', c.id);
        if (dueDay > info.paidCycleEndDay) canceledDriftedInvoice = true;
        logger.log(
          `Fatura ${c.id} da recorrência ${asaasSubId} (venc. ${dueDay}) cancelada — ` +
          `ciclo quitado via pagamento de dívida (assinatura ${info.subscriptionId}).`,
        );
      } catch (e: any) {
        logger.warn(
          `Não foi possível cancelar a fatura ${c.id} da recorrência ${asaasSubId}: ${e?.message} — ` +
          `cancelar manualmente no Asaas para o cliente parar de ser cobrado.`,
        );
      }
    }

    if (canceledDriftedInvoice) {
      try {
        await asaas.updateSubscription(asaasSubId, { nextDueDate: info.newCycleEndDay });
        logger.log(
          `Recorrência ${asaasSubId} realinhada: próxima fatura em ${info.newCycleEndDay} ` +
          `(novo dia-âncora da assinatura ${info.subscriptionId}).`,
        );
      } catch (e: any) {
        logger.warn(
          `Não foi possível realinhar o vencimento da recorrência ${asaasSubId} para ${info.newCycleEndDay}: ` +
          `${e?.message} — a próxima fatura virá no dia antigo, no meio do ciclo pago; ajustar no Asaas.`,
        );
      }
    }
  } catch (e: any) {
    logger.warn(
      `Limpeza de faturas pós-quitação falhou para a assinatura ${info.subscriptionId} (${e?.message}) — ` +
      `quitação e reativação seguem valendo; conferir cobranças em aberto no Asaas.`,
    );
  }
}
