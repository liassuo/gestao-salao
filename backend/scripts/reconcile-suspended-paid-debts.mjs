// Reconcilia assinaturas ENCERRADAS (SUSPENDED) cujo cliente JÁ pagou a dívida
// pela tela "Pagamento pendente → Pagar com PIX" (createPixChargeForDebts), mas
// a assinatura ficou presa em "Encerradas".
//
// CAUSA (corrigida no webhook): o PIX da tela de dívida é criado com
// notes='DEBT_PAYMENT' e SEM subscriptionId. Ao confirmar, o webhook quitava a
// dívida mas NUNCA entrava no bloco que reativa a assinatura (que exigia
// subscriptionId). Resultado: cliente pagou, dívida sumiu, assinatura encerrada.
//
// ============================ SEGURANÇA ============================
// Este script ESCREVE em produção (reativa assinatura, quita dívida). Para NÃO
// reativar/quitar de graça, a "prova de pagamento" é AMARRADA À DÍVIDA ABERTA
// (não basta "o cliente já pagou algo um dia"). Espelha as travas do webhook:
//   (1) CASAMENTO prova↔dívida: o pagamento tem que estar correlacionado à
//       dívida 'Cobrança não paga' em aberto AGORA — pela tag [asaas:<id>] que o
//       webhook OVERDUE embute na descrição da dívida, OU por ser POSTERIOR à
//       criação da dívida (paidAt/confirmedDate > debt.createdAt). Pagamento
//       antigo de um ciclo já encerrado NÃO serve.
//   (2) COBERTURA DE VALOR: só quita se o valor pago >= total pendente
//       (mesma trava de asaas-webhook.controller.ts: amount < totalPending → return).
//   (3) LIQUIDAÇÃO AO VIVO: confirma no Asaas via GET /v3/payments/{id} que a
//       cobrança está liquidada AGORA (não confia em status local/listagem que
//       pode estar defasado por estorno cujo webhook se perdeu).
// Sem TODAS as três → NÃO toca (mantém Encerrada). Erro de rede ao consultar o
// Asaas NÃO é tratado como "não pagou": vira SKIP-ERRO explícito.
//
// FATO DO DOMÍNIO (comentários do código, subscriptions.service.ts:985): cada
// cliente tem no máximo UMA assinatura; e o rótulo 'Cobrança não paga%' é
// exclusivo de inadimplência de assinatura (dívida avulsa/comanda usa outra
// descrição, subscriptions.service.spec.ts:696). Por isso reativar a assinatura
// do cliente ao quitar 'Cobrança não paga' é seguro.
//
// NÃO mexe em caixa/dashboard: o pagamento da dívida já foi (ou será)
// contabilizado pelo próprio webhook quando confirmou.
//
// Uso (a partir de backend/):
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/reconcile-suspended-paid-debts.mjs          # DRY-RUN
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/reconcile-suspended-paid-debts.mjs --apply  # ESCREVE

import 'dotenv/config';

const APPLY = process.argv.includes('--apply');

// Guard de ambiente ANTES de montar qualquer URL (senão .replace de undefined
// estoura com erro críptico em vez da mensagem clara).
const SUPA_URL = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ASAAS_PROD_KEY;
if (!SUPA_URL || !SKEY) {
  console.error('ABORTADO: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  process.exit(1);
}
if (!AKEY || !AKEY.startsWith('$aact_prod')) {
  console.error('ABORTADO: ASAAS_PROD_KEY ausente ou não é de produção ($aact_prod...).');
  process.exit(1);
}

const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
// Status de estorno/contestação: cobrança NÃO conta como paga (espelha isRevenuePayment).
const REFUNDED = ['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'];

async function sbget(table, params) {
  const u = new URL(SB + table);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: sh });
  if (!r.ok) throw new Error(`${table} GET ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function sbpatch(table, idFilter, patch) {
  const u = new URL(SB + table);
  u.searchParams.set('id', 'eq.' + idFilter);
  const r = await fetch(u, {
    method: 'PATCH',
    headers: { ...sh, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`patch ${table} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json(); // linhas afetadas (para auditar no-ops)
}
// Reativa só se ainda SUSPENDED (idempotência por filtro de status). Retorna as
// linhas realmente afetadas — vazio = não estava mais SUSPENDED (no-op).
async function reactivateIfSuspended(subId, patch) {
  const u = new URL(SB + 'client_subscriptions');
  u.searchParams.set('id', 'eq.' + subId);
  u.searchParams.set('status', 'eq.SUSPENDED');
  const r = await fetch(u, {
    method: 'PATCH',
    headers: { ...sh, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`reactivate ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
// Carimba o payment local de uma cobrança com o subscriptionId, p/ isCurrentCyclePaid
// enxergar o pagamento (corte coberto na comanda). NÃO cria payment novo (dobraria
// caixa); só vincula a linha que já existe e ainda não tem subscriptionId. Retorna
// as linhas afetadas (vazio = sem payment local p/ essa cobrança, ou já vinculado).
async function stampPaymentSubscription(asaasPaymentId, subId, nowIso) {
  const u = new URL(SB + 'payments');
  u.searchParams.set('asaasPaymentId', 'eq.' + asaasPaymentId);
  u.searchParams.set('subscriptionId', 'is.null');
  const r = await fetch(u, {
    method: 'PATCH',
    headers: { ...sh, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ subscriptionId: subId, updatedAt: nowIso }),
  });
  if (!r.ok) throw new Error(`stamp payment ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
// GET /v3/payments/{id} — status REAL e ao vivo da cobrança (não a listagem).
async function asaasGetCharge(id) {
  const r = await fetch(`https://api.asaas.com/v3/payments/${id}`, { headers: { access_token: AKEY } });
  if (!r.ok) throw new Error(`asaas getCharge ${id}: ${r.status}`);
  return r.json();
}
// Lista cobranças do cliente (paginada) — para descobrir candidatas a prova (B).
async function asaasListByCustomer(customerId) {
  const out = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) { // teto de segurança: 20*100 = 2000 cobranças
    const u = new URL('https://api.asaas.com/v3/payments');
    u.searchParams.set('customer', customerId);
    u.searchParams.set('limit', '100');
    u.searchParams.set('offset', String(offset));
    const r = await fetch(u, { headers: { access_token: AKEY } });
    if (!r.ok) throw new Error(`asaas list customer ${customerId}: ${r.status}`);
    const j = await r.json();
    const data = j?.data || [];
    out.push(...data);
    if (!j?.hasMore || data.length === 0) break;
    offset += data.length;
  }
  return out;
}
const chargePaidAt = (c) => c?.confirmedDate || c?.paymentDate || c?.clientPaymentDate || null;
// Extrai o asaasPaymentId embutido na descrição da dívida do webhook OVERDUE:
// 'Cobrança não paga — <plano> [asaas:<id>]'. (O cron usa [sub:...], sem asaas id.)
const debtAsaasTag = (desc) => {
  const m = /\[asaas:([^\]]+)\]/.exec(desc || '');
  return m ? m[1] : null;
};

async function main() {
  console.log(`========= RECON ENCERRADAS QUE PAGARAM A DÍVIDA — ${APPLY ? 'APPLY (ESCREVE)' : 'DRY-RUN'} =========\n`);

  const subs = await sbget('client_subscriptions', {
    select: 'id,clientId,status,createdAt,client:clients(id,name,asaasCustomerId),plan:subscription_plans!planId(name,price)',
    status: 'eq.SUSPENDED',
    order: 'createdAt.desc',
  });
  console.log(`Assinaturas SUSPENDED: ${subs.length}\n`);

  const audit = []; // trilha completa do que foi (ou seria) escrito
  let reactivated = 0, skippedNoProof = 0, skippedErr = 0, skippedShort = 0;

  for (const sub of subs) {
    const name = sub.client?.name || '?';
    const clientId = sub.clientId;
    const tag = `${name} (${clientId})`;

    try {
      // Dívidas de inadimplência de assinatura em aberto do cliente.
      const openDebts = await sbget('debts', {
        select: 'id,amount,remainingBalance,description,createdAt',
        clientId: 'eq.' + clientId,
        isSettled: 'eq.false',
        description: 'ilike.Cobrança não paga*',
      });
      if (openDebts.length === 0) {
        console.log(`  SKIP  ${name.padEnd(26)} — SUSPENDED sem dívida 'Cobrança não paga' aberta (não é este caso)`);
        skippedNoProof++;
        continue;
      }

      const totalPending = openDebts.reduce((s, d) => s + (d.remainingBalance ?? d.amount), 0);
      // Borda: dívida com valor 0/nulo → totalPending 0 deixaria QUALQUER cobrança
      // liquidada "cobrir" o pendente. Não há o que reativar com segurança aqui.
      if (totalPending <= 0) {
        console.log(`  SKIP  ${name.padEnd(26)} — dívida 'Cobrança não paga' com valor 0/nulo (revisar manualmente)`);
        skippedNoProof++;
        audit.push({ clientId, subId: sub.id, name, action: 'SKIP_ZERO_PENDING' });
        continue;
      }
      const oldestDebtCreatedAt = openDebts
        .map((d) => d.createdAt)
        .filter(Boolean)
        .sort()[0] || null;

      // ---------- Achar a PROVA, amarrada à dívida ----------
      // Candidatas: (1) tags [asaas:<id>] das próprias dívidas abertas; (2) payments
      // locais DEBT_PAYMENT do cliente; (3) cobranças 'Quitação de dívida' do cliente
      // no Asaas. Toda candidata é CONFIRMADA AO VIVO antes de valer como prova.
      const candidateIds = new Set();
      for (const d of openDebts) {
        const t = debtAsaasTag(d.description);
        if (t) candidateIds.add(t);
      }
      const localDebtPays = await sbget('payments', {
        select: 'id,asaasPaymentId,amount,asaasStatus,paidAt,notes',
        clientId: 'eq.' + clientId,
        notes: 'eq.DEBT_PAYMENT',
      });
      for (const p of localDebtPays) if (p.asaasPaymentId) candidateIds.add(p.asaasPaymentId);

      // Cobranças 'Quitação de dívida' do cliente no Asaas (externalReference=clientId
      // E description igual — match estrito, não regex frouxa nem só clientId).
      if (sub.client?.asaasCustomerId) {
        const charges = await asaasListByCustomer(sub.client.asaasCustomerId);
        for (const c of charges) {
          const isDebtCharge =
            c.externalReference === clientId && /^quita(ç|c)ão de d[ií]vida$/i.test((c.description || '').trim());
          if (isDebtCharge) candidateIds.add(c.id);
        }
      }

      // Avalia cada candidata AO VIVO: liquidada, não estornada, recente (depois da
      // dívida) e com valor que cobre o pendente.
      let proof = null;
      for (const chargeId of candidateIds) {
        const c = await asaasGetCharge(chargeId);
        if (!c || !c.status) continue;
        if (REFUNDED.includes(c.status)) continue;     // estornada → não conta
        if (!SETTLED.includes(c.status)) continue;     // não liquidada ao vivo
        const paidAt = chargePaidAt(c);
        // Recência: a prova tem que ser POSTERIOR à dívida aberta (pagamento DESTE
        // ciclo). Sem data confiável, só aceita se vier pela tag [asaas:] da própria
        // dívida (correlação direta dispensa a checagem temporal).
        const taggedToOpenDebt = openDebts.some((d) => debtAsaasTag(d.description) === chargeId);
        if (!taggedToOpenDebt) {
          if (!paidAt || !oldestDebtCreatedAt) continue;
          // Comparar SÓ por dia (YYYY-MM-DD). NÃO usar new Date() cru: paidAt do Asaas
          // é data pura (vira meia-noite UTC) e debt.createdAt é hora LOCAL — comparar
          // os dois como Date rejeitaria o pagamento do MESMO dia da dívida (o caso
          // dominante: dívida nasce de manhã, cliente paga via PIX à tarde). Aceita
          // pagamento no mesmo dia ou depois; rejeita só o de dia ANTERIOR (ciclo velho).
          const paidDay = String(paidAt).slice(0, 10);
          const debtDay = String(oldestDebtCreatedAt).slice(0, 10);
          if (paidDay < debtDay) continue; // pagamento de dia anterior à dívida → velho
        }
        const valueCentavos = Math.round(Number(c.value || 0) * 100);
        if (valueCentavos < totalPending) continue;    // não cobre o pendente
        proof = { chargeId, valueCentavos, paidAt, status: c.status, taggedToOpenDebt };
        break;
      }

      if (!proof) {
        console.log(`  SKIP  ${name.padEnd(26)} — sem prova VÁLIDA (pago>=devido, recente, liquidado ao vivo). Pendente=R$${(totalPending / 100).toFixed(2)}`);
        skippedNoProof++;
        audit.push({ clientId, subId: sub.id, name, action: 'SKIP_NO_VALID_PROOF', totalPending });
        continue;
      }

      console.log(
        `  PAGOU ${name.padEnd(26)} | pendente R$${(totalPending / 100).toFixed(2)} | prova ${proof.chargeId} R$${(proof.valueCentavos / 100).toFixed(2)} ${proof.taggedToOpenDebt ? '[tag]' : '[data>dívida]'}`,
      );

      if (!APPLY) {
        reactivated++;
        audit.push({ clientId, subId: sub.id, name, action: 'WOULD_REACTIVATE', totalPending, proof, debtIds: openDebts.map((d) => d.id) });
        continue;
      }

      // ---------- ESCRITA: reativar ANTES de quitar ----------
      // Reativar é idempotente (filtro SUSPENDED) e reversível; quitar dívida é a
      // operação "perde a cobrança". Se a quitação falhar, melhor o cliente ficar
      // ATIVO com dívida (visível) do que sem dívida e Encerrado.
      const reactNow = new Date();
      const reactEnd = new Date(reactNow); reactEnd.setMonth(reactEnd.getMonth() + 1);
      const nowIso = reactNow.toISOString();
      const reactEndIso = reactEnd.toISOString();

      const reactRows = await reactivateIfSuspended(sub.id, {
        status: 'ACTIVE', cutsUsedThisMonth: 0,
        lastResetDate: nowIso, endDate: reactEndIso, updatedAt: nowIso,
      });
      const didReactivate = Array.isArray(reactRows) && reactRows.length > 0;

      // Vincular o payment da prova à assinatura → ciclo conta como pago (corte coberto
      // na comanda). Só carimba a linha existente; não cria payment (não dobra caixa).
      const stamped = await stampPaymentSubscription(proof.chargeId, sub.id, nowIso);
      const didStamp = Array.isArray(stamped) && stamped.length > 0;

      const settledDebtIds = [];
      for (const d of openDebts) {
        await sbpatch('debts', d.id, {
          amountPaid: d.amount, remainingBalance: 0, isSettled: true,
          paidAt: nowIso, updatedAt: nowIso,
        });
        settledDebtIds.push(d.id);
      }
      // Recalcula hasDebts (pode restar dívida de OUTRA natureza, não 'Cobrança não paga').
      const remaining = await sbget('debts', { select: 'id', clientId: 'eq.' + clientId, isSettled: 'eq.false' });
      await sbpatch('clients', clientId, { hasDebts: remaining.length > 0 });

      console.log(
        `    OK — ${didReactivate ? 'reativada' : 'JÁ não-SUSPENDED (no-op)'} até ${reactEndIso.slice(0, 10)}; ${settledDebtIds.length} dívida(s) quitada(s); pagamento ${didStamp ? 'vinculado (ciclo pago)' : 'sem payment local p/ vincular'}; hasDebts=${remaining.length > 0}`,
      );
      reactivated++;
      audit.push({
        clientId, subId: sub.id, name, action: 'REACTIVATED',
        didReactivate, stampedCyclePaid: didStamp, endDate: reactEndIso, totalPending,
        proof, settledDebtIds, remainingDebts: remaining.length, at: nowIso,
      });
    } catch (e) {
      // Erro (rede Asaas, DB) NÃO vira "não pagou": registra e segue p/ o próximo.
      console.log(`  ERRO  ${name.padEnd(26)} — ${e.message} (pulado, NÃO reativado)`);
      skippedErr++;
      audit.push({ clientId, subId: sub.id, name, action: 'ERROR', error: e.message });
    }
  }

  console.log(
    `\n${APPLY ? 'Reativadas' : 'A reativar'}: ${reactivated} | Sem prova/dívida: ${skippedNoProof} | Erros: ${skippedErr}`,
  );
  // Trilha de auditoria parseável no stdout (capture com '> recon.log' ou '| tee').
  console.log('\n--- AUDIT JSON ---');
  console.log(JSON.stringify(audit, null, 2));
  if (!APPLY) console.log('\n(DRY-RUN: nada escrito. Revise a lista acima e rode com --apply para aplicar.)');
}
main().catch((e) => { console.error('FALHA GERAL:', e.message); process.exit(1); });
