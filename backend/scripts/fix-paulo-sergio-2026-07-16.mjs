// FIX 16/07/2026 — Paulo Sergio Santiago Gomes pagou R$140 no PIX (Quitação de
// dívida, pay_qyb90ftpmc4w5az7, RECEIVED no Asaas em 16/07) mas nada baixou:
// o espelho local DEBT_PAYMENT nunca é criado (insert sem registeredBy falha
// silenciosamente desde 03/2026) → webhook não acha o payment e não quita;
// syncWithAsaas não enxerga cobrança com externalReference=clientId; e o botão
// "Confirmar pagamento" da reconciliação (usado 16/07 17:36 UTC, payment
// e5054b71 já no caixa) registra o pagamento mas não quita dívida nem reativa.
//
// Ações (espelham o que settleDebtPaymentAndReactivate teria feito):
//  1. quita a dívida 7d24d02d (R$140, ciclo 2026-07-15);
//  2. reativa a assinatura 423348c3 com dia-âncora (venceu 15/07, pagou 16/07
//     dentro da carência de 7d): startDate=15/07, endDate=15/08, cortes zerados;
//  3. clients.hasDebts=false;
//  4. vincula o payment e5054b71 à assinatura (isCurrentCyclePaid volta a valer);
//  5. comanda de hoje (appt 6ad4cbc9 / order c3637239, Corte R$40): coberta pelo
//     plano (Corte 100%), debita 1 corte — mesmo padrão do fix do Márcio.
// GUARDAS: cobrança precisa estar RECEIVED/CONFIRMED no Asaas; comanda só é
// zerada se ainda não paga/fechada; tudo idempotente (no-op se já corrigido).
//
// USO: node scripts/fix-paulo-sergio-2026-07-16.mjs [--apply]
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
};
const sg = async (t, p) => {
  const u = new URL(SB + t);
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: sh });
  if (!r.ok) throw new Error(`GET ${t} ${r.status} ${await r.text()}`);
  return r.json();
};
const spatch = async (t, id, body) => {
  const r = await fetch(`${SB}${t}?id=eq.${id}`, {
    method: 'PATCH', headers: { ...sh, Prefer: 'return=representation' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${t}/${id} ${r.status} ${await r.text()}`);
  return r.json();
};

const CLIENT_ID = '9b02aca6-9b79-4c79-9b61-75e02bac08b0';
const SUB_ID = '423348c3-457e-4999-bc58-c8663d10c1ae';
const DEBT_ID = '7d24d02d-345d-4596-a103-5c8ea8ba3eb2';
const PAY_LOCAL_ID = 'e5054b71-7ddf-497e-9b03-01ea5e1711bb';
const ASAAS_PAY = 'pay_qyb90ftpmc4w5az7';
const APPT_ID = '6ad4cbc9-3804-4b0e-bf68-9f3306787a7f';
const ORDER_ID = 'c3637239-6770-462f-872b-6f5c2f54201a';
const ITEM_ID = '96b7d746-0e52-4e6c-91c7-d022e8722f50';
// Dia-âncora: ciclo anterior 15/06→15/07, pagou 16/07 (carência 7d) → 15/07→15/08.
const NEW_START = '2026-07-15T21:51:15.486';
const NEW_END = '2026-08-15T21:51:15.486';

const nowIso = new Date().toISOString();
console.log(APPLY ? '== APPLY ==' : '== DRY-RUN ==');

// Guarda 0: cobrança realmente liquidada no Asaas (fonte da verdade).
const ar = await fetch('https://api.asaas.com/v3/payments/' + ASAAS_PAY, {
  headers: { access_token: process.env.ASAAS_API_KEY },
});
if (!ar.ok) throw new Error(`Asaas ${ASAAS_PAY} ${ar.status}`);
const charge = await ar.json();
console.log('Asaas:', JSON.stringify({ id: charge.id, status: charge.status, value: charge.value, paymentDate: charge.paymentDate, deleted: charge.deleted }));
if (!['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(charge.status) || charge.deleted) {
  console.log('ABORTANDO: cobrança não liquidada no Asaas.');
  process.exit(1);
}
if (Math.round(Number(charge.value) * 100) !== 14000) {
  console.log('ABORTANDO: valor difere de R$140.');
  process.exit(1);
}

const [debt] = await sg('debts', { select: 'id,isSettled,remainingBalance,amount', id: 'eq.' + DEBT_ID });
const [sub] = await sg('client_subscriptions', { select: 'id,status,startDate,endDate,cutsUsedThisMonth', id: 'eq.' + SUB_ID });
const [cli] = await sg('clients', { select: 'id,hasDebts', id: 'eq.' + CLIENT_ID });
const [pay] = await sg('payments', { select: 'id,subscriptionId,paidAt,amount,asaasPaymentId', id: 'eq.' + PAY_LOCAL_ID });
const [appt] = await sg('appointments', { select: 'id,status,totalPrice,isPaid,usedSubscriptionCut', id: 'eq.' + APPT_ID });
const [order] = await sg('orders', { select: 'id,status,totalAmount', id: 'eq.' + ORDER_ID });
const apptPays = await sg('payments', { select: 'id,paidAt', appointmentId: 'eq.' + APPT_ID });

console.log('debt:', JSON.stringify(debt));
console.log('sub:', JSON.stringify(sub));
console.log('cli:', JSON.stringify(cli));
console.log('pay local:', JSON.stringify(pay));
console.log('appt:', JSON.stringify(appt));
console.log('order:', JSON.stringify(order));

if (!debt || !sub || !cli || !pay) throw new Error('Registro base não encontrado.');
if (pay.asaasPaymentId !== ASAAS_PAY) throw new Error('payment local não corresponde à cobrança.');

// 1-4: dívida, assinatura, hasDebts, vínculo do payment
const planoAcoes = [];
if (!debt.isSettled) planoAcoes.push(`quitar dívida ${DEBT_ID.slice(0, 8)} (R$${debt.amount / 100})`);
if (sub.status !== 'ACTIVE') planoAcoes.push(`reativar assinatura: ${sub.status}→ACTIVE, ciclo ${NEW_START.slice(0, 10)}→${NEW_END.slice(0, 10)}, cortes=0`);
if (cli.hasDebts) planoAcoes.push('hasDebts=false');
if (!pay.subscriptionId) planoAcoes.push('payment e5054b71 ← subscriptionId');

// 5: comanda coberta pelo plano
const comandaPaga = appt?.isPaid || apptPays.some((p) => p.paidAt) || ['PAID', 'CLOSED', 'COMPLETED'].includes(order?.status);
const comandaJaCoberta = appt && appt.totalPrice === 0 && appt.usedSubscriptionCut;
let fixComanda = false;
if (!appt || !order) console.log('Comanda/agendamento não encontrado — pulando passo 5.');
else if (comandaPaga) console.log('Comanda já paga/fechada — NÃO mexer (seria estorno).');
else if (comandaJaCoberta) console.log('Comanda já coberta — no-op.');
else { fixComanda = true; planoAcoes.push('cobrir comanda pelo plano (R$40→0, 1 corte debitado)'); }

if (planoAcoes.length === 0) { console.log('Nada a fazer — tudo já corrigido.'); process.exit(0); }
console.log('\nAções:\n - ' + planoAcoes.join('\n - '));

if (!APPLY) { console.log('\n(DRY-RUN: rode com --apply para aplicar.)'); process.exit(0); }

if (!debt.isSettled) {
  await spatch('debts', DEBT_ID, { isSettled: true, remainingBalance: 0, paidAt: nowIso, updatedAt: nowIso });
}
if (sub.status !== 'ACTIVE') {
  await spatch('client_subscriptions', SUB_ID, {
    status: 'ACTIVE', startDate: NEW_START, endDate: NEW_END,
    cutsUsedThisMonth: 0, lastResetDate: nowIso, isComp: false, updatedAt: nowIso,
  });
}
if (cli.hasDebts) await spatch('clients', CLIENT_ID, { hasDebts: false });
if (!pay.subscriptionId) await spatch('payments', PAY_LOCAL_ID, { subscriptionId: SUB_ID, updatedAt: nowIso });

if (fixComanda) {
  await spatch('appointments', APPT_ID, { totalPrice: 0, usedSubscriptionCut: true, updatedAt: nowIso });
  await spatch('orders', ORDER_ID, { totalAmount: 0, updatedAt: nowIso });
  await spatch('order_items', ITEM_ID, { unitPrice: 0, consumedSubscriptionCut: true });
  const [s2] = await sg('client_subscriptions', { select: 'id,cutsUsedThisMonth', id: 'eq.' + SUB_ID });
  await spatch('client_subscriptions', SUB_ID, { cutsUsedThisMonth: (s2?.cutsUsedThisMonth ?? 0) + 1, updatedAt: nowIso });
}
console.log('OK — dívida quitada, assinatura ativa até 15/08, comanda coberta pelo plano.');
