// FIX 16/07/2026 — Renato dias (relato do barbeiro: "ativo mas o app cobra /
// assinatura pendente"). A assinatura local está correta (ACTIVE 30/06→30/07,
// sem dívida): ele pagou R$79,90 NO BALCÃO em 30/06 (confirmação manual). Mas a
// recorrência Asaas (sub_b65q1l5ucf90c4d4) gerou a fatura do ciclo 30/06, que
// ficou órfã e virou OVERDUE (pay_90yfe5ce4uktygho) — o Asaas segue cobrando o
// cliente por e-mail e há risco de pagar 2x. Mesmo padrão Kleudson/Vandson
// (confirmação manual de 30/06 foi ANTES do PR #44, que cancela essas órfãs).
//
// Ação: cancelar a cobrança OVERDUE órfã no Asaas. A PENDING do próximo ciclo
// (pay_hyjkmuaqjva5ddpk, venc. 30/07) fica — é a fatura legítima do ciclo que
// vem; se ele pagar no balcão de novo, o código pós-PR #44 a cancela sozinho.
// GUARDAS: só cancela se a cobrança segue OVERDUE, não-paga e não-deletada.
//
// USO: node scripts/fix-renato-dias-2026-07-16.mjs [--apply]
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const CHARGE = 'pay_90yfe5ce4uktygho';
const h = { access_token: process.env.ASAAS_API_KEY };

console.log(APPLY ? '== APPLY ==' : '== DRY-RUN ==');

const r = await fetch('https://api.asaas.com/v3/payments/' + CHARGE, { headers: h });
if (!r.ok) throw new Error(`Asaas GET ${CHARGE} ${r.status}`);
const c = await r.json();
console.log('cobrança:', JSON.stringify({
  id: c.id, status: c.status, value: c.value, dueDate: c.dueDate,
  paymentDate: c.paymentDate, deleted: c.deleted, subscription: c.subscription,
  description: (c.description || '').slice(0, 60),
}, null, 1));

if (c.deleted) { console.log('Já cancelada — no-op.'); process.exit(0); }
if (c.status !== 'OVERDUE' || c.paymentDate) {
  console.log(`ABORTANDO: estado inesperado (status=${c.status}, paymentDate=${c.paymentDate}). Se estiver paga, NÃO cancelar.`);
  process.exit(1);
}

console.log('\nAção: cancelar (DELETE) a cobrança OVERDUE órfã — ciclo 30/06 já pago no balcão (payment local 9c3f03ae, R$79,90 CARD).');
if (!APPLY) { console.log('(DRY-RUN: rode com --apply para aplicar.)'); process.exit(0); }

const del = await fetch('https://api.asaas.com/v3/payments/' + CHARGE, { method: 'DELETE', headers: h });
const body = await del.json();
if (!del.ok || !body.deleted) throw new Error(`DELETE falhou: ${del.status} ${JSON.stringify(body)}`);
console.log('OK — cobrança cancelada no Asaas:', JSON.stringify(body));
