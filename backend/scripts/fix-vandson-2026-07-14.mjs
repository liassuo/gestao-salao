// FIX 14/07/2026 — caso Vandson Silva Sousa (relato do Wanderson por áudio):
// renovou manualmente no balcão (R$79,90 PIX, payment 328324f5), assinatura foi
// para ACTIVE, mas ficou "Inadimplente": a confirmação manual não quitava a
// dívida (mesma lacuna do caso Kleudson 10/07 — código corrigido no PR novo).
//
// O que faz (idempotente):
//   1. Quita a dívida 4d329eae (R$79,90, [sub:a43d5e44:cycle:2026-07-13]) —
//      o ciclo dela foi pago no balcão em 14/07.
//   2. Recalcula clients.hasDebts pelas dívidas em aberto restantes.
//   3. Cancela NO ASAAS a cobrança órfã pay_pu8962tdbzo28nqw (link de renovação
//      PENDING gerado 27s antes da confirmação manual — se o cliente pagar o
//      link, paga o mesmo ciclo DUAS vezes) e marca o espelho local CANCELED.
//
// Uso:  node scripts/fix-vandson-2026-07-14.mjs           (dry-run)
//       node scripts/fix-vandson-2026-07-14.mjs --apply
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
};
const AKEY = process.env.ASAAS_API_KEY;

const sg = async (t, p) => {
  const u = new URL(SB + t);
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: sh });
  if (!r.ok) throw new Error(`GET ${t} ${r.status}: ${await r.text()}`);
  return r.json();
};
const sp = async (t, p, body) => {
  const u = new URL(SB + t);
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { method: 'PATCH', headers: sh, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH ${t} ${r.status}: ${await r.text()}`);
};
const ag = async (path, method = 'GET') => {
  const r = await fetch('https://api.asaas.com/v3/' + path, { method, headers: { access_token: AKEY } });
  if (!r.ok) throw new Error(`asaas ${method} ${path} ${r.status}: ${await r.text()}`);
  return r.json();
};

const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const nowLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const CLIENT_ID = 'b2b3ae5c-bfc2-48de-b2b5-76e477eef828'; // Vandson
const DEBT_ID = '4d329eae-604d-4a49-8061-d970b54e1dec';
const ORPHAN_ASAAS = 'pay_pu8962tdbzo28nqw';
const ORPHAN_LOCAL = 'a6eb0621-9679-45dd-afec-52a0faf3578b';
const BALCAO_PAYMENT = '328324f5-fedd-483f-89f1-9dba2a575593';

// Pré-condições (aborta se o mundo mudou desde o diagnóstico)
const [debt] = await sg('debts', { select: 'id,amount,isSettled,remainingBalance,description', id: 'eq.' + DEBT_ID });
const [balcao] = await sg('payments', { select: 'id,amount,paidAt', id: 'eq.' + BALCAO_PAYMENT });
const [orphan] = await sg('payments', { select: 'id,asaasStatus,paidAt', id: 'eq.' + ORPHAN_LOCAL });
const charge = await ag('payments/' + ORPHAN_ASAAS);
console.log(`dívida: settled=${debt?.isSettled} R$${(debt?.amount ?? 0) / 100} | pagamento balcão: paidAt=${balcao?.paidAt} R$${(balcao?.amount ?? 0) / 100}`);
console.log(`cobrança órfã: local=${orphan?.asaasStatus} asaas=${charge.status} deleted=${charge.deleted}`);

if (!balcao?.paidAt) throw new Error('Pagamento do balcão não encontrado/pago — não quitar a dívida.');
if (debt?.isSettled) console.log('Dívida JÁ quitada — etapa 1 vira no-op.');
if (charge.status === 'RECEIVED' || charge.status === 'CONFIRMED') {
  throw new Error('Cobrança órfã já foi PAGA no Asaas — NÃO cancelar; caso de estorno/crédito, tratar manualmente.');
}

if (!APPLY) {
  console.log('\nDRY-RUN. Com --apply fará:');
  console.log(`  1. debts ${DEBT_ID}: isSettled=true, amountPaid=${debt.amount}, remainingBalance=0, paidAt=${nowLocal}`);
  console.log(`  2. clients ${CLIENT_ID}: hasDebts recalculado pelas dívidas abertas restantes`);
  console.log(`  3. Asaas DELETE payments/${ORPHAN_ASAAS} + payments local ${ORPHAN_LOCAL} -> CANCELED`);
  process.exit(0);
}

// 1. quitar dívida
if (!debt.isSettled) {
  await sp('debts', { id: 'eq.' + DEBT_ID }, {
    amountPaid: debt.amount,
    remainingBalance: 0,
    isSettled: true,
    paidAt: nowLocal,
    updatedAt: nowLocal,
  });
  console.log('1. dívida quitada.');
}

// 2. hasDebts pelas restantes
const remaining = await sg('debts', { select: 'id', clientId: 'eq.' + CLIENT_ID, isSettled: 'eq.false' });
await sp('clients', { id: 'eq.' + CLIENT_ID }, { hasDebts: remaining.length > 0 });
console.log(`2. hasDebts=${remaining.length > 0} (${remaining.length} dívida(s) aberta(s) restante(s)).`);

// 3. cancelar cobrança órfã no Asaas + espelho local
if (!charge.deleted) {
  await ag('payments/' + ORPHAN_ASAAS, 'DELETE');
  console.log(`3a. cobrança ${ORPHAN_ASAAS} cancelada no Asaas.`);
} else {
  console.log('3a. cobrança já estava cancelada no Asaas.');
}
await sp('payments', { id: 'eq.' + ORPHAN_LOCAL }, { asaasStatus: 'CANCELED', updatedAt: nowLocal });
console.log('3b. espelho local marcado CANCELED.');

// verificação
const [cli] = await sg('clients', { select: 'name,hasDebts', id: 'eq.' + CLIENT_ID });
const [d2] = await sg('debts', { select: 'isSettled,remainingBalance', id: 'eq.' + DEBT_ID });
const c2 = await ag('payments/' + ORPHAN_ASAAS);
console.log(`\nVERIFICAÇÃO: ${cli.name} hasDebts=${cli.hasDebts} | dívida settled=${d2.isSettled} saldo=${d2.remainingBalance} | Asaas ${ORPHAN_ASAAS}: deleted=${c2.deleted} status=${c2.status}`);
console.log('APLICADO.');
