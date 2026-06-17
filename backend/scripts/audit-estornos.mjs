// AUDITORIA read-only (NÃO escreve nada). Cruza banco (Supabase) x Asaas p/ listar
// os ESTORNOS e separar os que PROVAVELMENTE foram causados pela exclusão de cobrança
// paga (cancel/no-show/atender excluíam DELETE /payments sem conferir status real →
// estorno automático de cartão CONFIRMED/RECEIVED). Roda com a chave de prod.
//
// Hipótese investigada (PR fix/estorno-automatico-cancelcharge-guard):
//   Excluir uma cobrança de cartão CONFIRMED/RECEIVED no Asaas GERA ESTORNO. Os
//   fluxos de agendamento decidiam excluir pelo `paidAt` LOCAL (null no race do
//   webhook PAYMENT_CONFIRMED) → estornavam cobrança já paga.
//
// 2 listas:
//  PROVÁVEL EXCLUSÃO: estorno cujo pagamento tem agendamento CANCELED/NO_SHOW/ATTENDED
//          e a data do estorno cai PERTO (<= JANELA_DIAS) da ação no agendamento.
//          Forte suspeita de ter sido causado pela exclusão da cobrança.
//  MANUAL/OUTRO: estorno sem essa correlação (sem agendamento, agendamento ainda ativo,
//          ou estorno distante da ação) → provável estorno manual no painel / chargeback.
//
// Uso (a partir de backend/):
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/audit-estornos.mjs
//   # opcional: janela de correlação (default 3) e recorte por data de atualização:
//   JANELA_DIAS=3 DESDE=2026-01-01 node scripts/audit-estornos.mjs

import 'dotenv/config';
const SUPA_URL = process.env.SUPABASE_URL, SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY, AKEY = process.env.ASAAS_PROD_KEY;
if (!SUPA_URL || !SKEY) { console.error('ABORTADO: Supabase ausente.'); process.exit(1); }
if (!AKEY || !AKEY.startsWith('$aact_prod')) { console.error('ABORTADO: ASAAS_PROD_KEY ausente/não-prod.'); process.exit(1); }

const JANELA_DIAS = Number(process.env.JANELA_DIAS || 3);
const DESDE = process.env.DESDE || null; // ISO date opcional (filtra payments.updatedAt)
const REFUND_STATUSES = ['REFUNDED', 'REFUND_IN_PROGRESS'];
const ACAO_STATUSES = ['CANCELED', 'NO_SHOW', 'ATTENDED'];
const DIA_MS = 864e5;

const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const sg = async (t, p) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); if (!r.ok) throw new Error(`${t} ${r.status} ${await r.text()}`); return r.json(); };
// getCharge: objeto único; null em erro (cobrança 404/deletada que não responde).
const agCharge = async (id) => { try { const r = await fetch('https://api.asaas.com/v3/payments/' + id, { headers: { access_token: AKEY } }); return r.ok ? r.json() : null; } catch { return null; } };
const reais = (cent) => 'R$' + ((cent || 0) / 100).toFixed(2);
const reaisFromAsaas = (v) => 'R$' + ((v || 0)).toFixed(2);
const dt = (s) => (s ? new Date(s).toISOString().slice(0, 16).replace('T', ' ') : '—');
const dayGap = (a, b) => (a && b ? Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DIA_MS : null);

// Data REAL do estorno a partir do charge do Asaas (effectiveDate > dateCreated do
// refund DONE/PENDING); fallback p/ updatedAt local quando não há refunds[].
function refundInfo(charge, payment) {
  const refunds = Array.isArray(charge?.refunds) ? charge.refunds : [];
  const live = refunds.filter((r) => r.status !== 'CANCELLED');
  if (live.length) {
    const r = live[live.length - 1];
    return {
      date: r.effectiveDate || r.dateCreated || payment.updatedAt || null,
      valueReais: live.reduce((s, x) => s + (x.value || 0), 0),
      status: r.status,
      receipt: r.transactionReceiptUrl || null,
      synthetic: false,
    };
  }
  // Sem refunds[] (ex.: chargeback) → sintetiza pelo bruto da cobrança.
  return { date: payment.updatedAt || null, valueReais: charge?.value || (payment.amount || 0) / 100, status: charge?.status || payment.asaasStatus, receipt: null, synthetic: true };
}

async function main() {
  console.log('===== AUDITORIA ESTORNOS (read-only) — ' + new Date().toISOString().slice(0, 16) + ' =====');
  console.log(`Janela de correlação: ${JANELA_DIAS} dia(s)${DESDE ? ` · desde ${DESDE}` : ''}\n`);

  const params = {
    select: 'id,asaasPaymentId,amount,method,billingType,asaasStatus,paidAt,businessDate,updatedAt,appointmentId,clientId,client:clients(name,phone),appointment:appointments!appointmentId(id,status,canceledAt,attendedAt,scheduledAt,updatedAt,isPaid)',
    asaasStatus: `in.(${REFUND_STATUSES.join(',')})`,
    order: 'updatedAt.desc',
  };
  if (DESDE) params.updatedAt = `gte.${DESDE}`;

  const payments = await sg('payments', params);
  if (!payments.length) { console.log('Nenhum pagamento com status de estorno no recorte. ✓'); return; }

  const provavel = [], outro = [];

  for (const p of payments) {
    const charge = p.asaasPaymentId ? await agCharge(p.asaasPaymentId) : null;
    const rf = refundInfo(charge, p);
    const appt = p.appointment || null;
    const billing = p.billingType || p.method || '?';
    const isCard = /CARD|CREDIT/i.test(billing);

    // Data da ação que pode ter disparado a exclusão (cancelamento/atendimento/no-show).
    const acaoDate = appt ? (appt.canceledAt || appt.attendedAt || appt.updatedAt || null) : null;
    const gap = dayGap(rf.date, acaoDate);
    const correlacionado =
      appt && ACAO_STATUSES.includes(appt.status) && gap != null && gap <= JANELA_DIAS;

    const row = {
      cliente: p.client?.name || '(sem nome)',
      valor: reaisFromAsaas(rf.valueReais),
      billing,
      isCard,
      asaasStatus: p.asaasStatus,
      refundStatus: rf.status + (rf.synthetic ? ' (sintetizado)' : ''),
      apptStatus: appt?.status || '(sem agendamento)',
      acaoDate: dt(acaoDate),
      estornoDate: dt(rf.date),
      gapDias: gap == null ? '—' : gap.toFixed(1),
      asaasPaymentId: p.asaasPaymentId,
    };
    (correlacionado ? provavel : outro).push(row);
  }

  const print = (title, rows) => {
    console.log(`\n===== ${title} (${rows.length}) =====`);
    if (!rows.length) { console.log('  (nenhum)'); return; }
    for (const r of rows) {
      console.log(
        `  ${r.cliente} · ${r.valor} · ${r.billing}${r.isCard ? ' 💳' : ''} · agendamento=${r.apptStatus}\n` +
        `     ação=${r.acaoDate} | estorno=${r.estornoDate} | gap=${r.gapDias}d | asaasStatus=${r.asaasStatus} | refund=${r.refundStatus}\n` +
        `     charge=${r.asaasPaymentId}`,
      );
    }
  };

  print('PROVÁVEL EXCLUSÃO (suspeita: estorno causado pela exclusão da cobrança paga)', provavel);
  print('MANUAL/OUTRO (sem correlação com cancel/no-show/atender)', outro);

  const cards = provavel.filter((r) => r.isCard).length;
  console.log('\n===== RESUMO =====');
  console.log(`  Total de estornos analisados: ${payments.length}`);
  console.log(`  PROVÁVEL EXCLUSÃO: ${provavel.length} (cartão: ${cards})`);
  console.log(`  MANUAL/OUTRO: ${outro.length}`);
  console.log('\n  Nota: "PROVÁVEL EXCLUSÃO" = agendamento CANCELED/NO_SHOW/ATTENDED + estorno dentro');
  console.log(`        de ${JANELA_DIAS} dia(s) da ação. A guarda do PR impede novos casos; estes são histórico.`);
}

main().catch((e) => { console.error('FALHA:', e); process.exit(1); });
