// FIX 16/07/2026 — vítimas do webhook OVERDUE que suspendia assinatura JÁ PAGA.
//
// Padrão: cliente pagou a mensalidade no balcão (confirmação manual renovou o
// vencimento), mas a fatura daquele ciclo continuou aberta no Asaas e venceu →
// webhook PAYMENT_OVERDUE suspendeu a assinatura PAGA e criou dívida-fantasma →
// o app passou a cobrar de novo (alguns pagaram 2x). Causa corrigida no código
// (guard de ciclo já superado em handlePaymentOverdue).
//
// Ações por vítima (todas idempotentes e verificadas ao vivo):
//  1. assinatura SUSPENDED → ACTIVE (endDate/startDate/cortes INTACTOS: o ciclo
//     vigente já estava correto — só o status foi corrompido pelo webhook);
//  2. dívida-fantasma do ciclo já pago → anulada (isSettled, remainingBalance=0);
//  3. hasDebts recalculado pelas dívidas REALMENTE abertas;
//  4. cobrança órfã cancelada no Asaas (para o gateway parar de cobrar).
//
// NÃO mexe em dinheiro: pagamentos duplicados (Murilo Correa, Gustavo) são
// apenas RELATADOS — crédito/estorno é decisão do dono.
//
// GUARDAS: só age se a assinatura estiver SUSPENDED com endDate FUTURO (prova de
// ciclo pago e superado) e a cobrança órfã não estiver paga no Asaas.
//
// USO: node scripts/fix-suspensos-por-cobranca-orfa-2026-07-16.mjs [--apply]
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
};
const ah = { access_token: process.env.ASAAS_API_KEY };
const g = async (q) => { const r = await fetch(SB + q, { headers: sh }); if (!r.ok) throw new Error(`GET ${q} ${r.status}`); return r.json(); };
const patch = async (t, id, body) => {
  const r = await fetch(`${SB}${t}?id=eq.${id}`, { method: 'PATCH', headers: { ...sh, Prefer: 'return=representation' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH ${t}/${id} ${r.status} ${await r.text()}`);
  return r.json();
};
const ag = async (p) => { const r = await fetch('https://api.asaas.com/v3/' + p, { headers: ah }); if (!r.ok) throw new Error(`asaas ${p} ${r.status}`); return r.json(); };

// sub = assinatura suspensa indevidamente; debt = dívida-fantasma; charge = cobrança órfã.
const VITIMAS = [
  { nome: 'Murilo Correa', sub: 'c0df42fa-', debt: '3160ff4c-', charges: ['pay_fat3hkprjwmgfgo3'] },
  { nome: 'Gustavo Hernane', sub: '3aaeb5f7-', debt: 'fd290ae6-', charges: ['pay_ddyrchtuunvx78st'] },
  { nome: 'Emanuel', sub: '6352c73c-', debt: 'c8108d90-', charges: ['pay_mccc0u9bwmtclvti'] },
];
// Assinaturas ACTIVE que só têm a cobrança órfã cobrando indevidamente.
const ORFAS_SOLTAS = [
  { nome: 'Murilo Barbosa', charge: 'pay_u8ofizbuctplr8ed' },
  { nome: 'Gabriel Fernandes', charge: 'pay_askk9b89jjvvr4um' },
];

const nowIso = new Date().toISOString();
const nowMs = Date.now();
console.log(APPLY ? '== APPLY ==' : '== DRY-RUN ==', '\n');

async function cancelarOrfa(chargeId, nome) {
  const c = await ag('payments/' + chargeId);
  if (c.deleted) { console.log(`   [${nome}] ${chargeId}: já cancelada — no-op.`); return; }
  if (c.paymentDate || ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(c.status)) {
    console.log(`   [${nome}] ${chargeId}: ATENÇÃO — está PAGA (${c.status}, ${c.paymentDate}). NÃO cancelar. Pulando.`);
    return;
  }
  console.log(`   [${nome}] cancelar cobrança órfã ${chargeId} (${c.status}, R$${c.value}, venc ${c.dueDate})`);
  if (!APPLY) return;
  const r = await fetch('https://api.asaas.com/v3/payments/' + chargeId, { method: 'DELETE', headers: ah });
  const body = await r.json();
  if (!r.ok || !body.deleted) throw new Error(`DELETE ${chargeId} falhou: ${JSON.stringify(body)}`);
  // espelho local (quando existe) deixa de aparecer como cobrança pendente
  const espelhos = await g(`payments?asaasPaymentId=eq.${chargeId}&select=id`);
  for (const e of espelhos) await patch('payments', e.id, { asaasStatus: 'CANCELED', updatedAt: nowIso });
  console.log(`   [${nome}] OK — cancelada no Asaas${espelhos.length ? ' + espelho CANCELED' : ''}.`);
}

for (const v of VITIMAS) {
  console.log('='.repeat(60));
  console.log('VÍTIMA:', v.nome);

  const [sub] = await g(`client_subscriptions?id=like.${v.sub}*&select=id,clientId,status,startDate,endDate,cutsUsedThisMonth`);
  const [debt] = await g(`debts?id=like.${v.debt}*&select=id,clientId,amount,isSettled,description`);
  if (!sub || !debt) { console.log('   registro não encontrado — pulando.'); continue; }

  const endMs = new Date(sub.endDate).getTime();
  console.log(`   sub ${sub.id.slice(0, 8)}: ${sub.status} | ciclo até ${sub.endDate}`);
  console.log(`   dívida ${debt.id.slice(0, 8)}: R$${debt.amount / 100} ${debt.isSettled ? 'QUITADA' : 'ABERTA'}`);

  // GUARDA: só o padrão exato (suspensa com ciclo vigente no futuro = paga e superada).
  if (sub.status !== 'SUSPENDED' || !(endMs > nowMs)) {
    console.log(`   GUARDA: não é o padrão (status=${sub.status}, endDate futuro=${endMs > nowMs}) — pulando.`);
    continue;
  }

  console.log('   Ações: status→ACTIVE (ciclo/cortes intactos); dívida-fantasma anulada; hasDebts recalculado.');
  if (APPLY) {
    await patch('client_subscriptions', sub.id, { status: 'ACTIVE', updatedAt: nowIso });
    if (!debt.isSettled) {
      await patch('debts', debt.id, {
        isSettled: true, amountPaid: debt.amount, remainingBalance: 0, paidAt: nowIso, updatedAt: nowIso,
      });
    }
    const abertas = await g(`debts?clientId=eq.${sub.clientId}&isSettled=eq.false&select=id`);
    await patch('clients', sub.clientId, { hasDebts: abertas.length > 0 });
    console.log(`   OK — assinatura ativa; dívidas abertas restantes: ${abertas.length}`);
  }
  for (const ch of v.charges) await cancelarOrfa(ch, v.nome);
}

console.log('\n' + '='.repeat(60));
console.log('COBRANÇAS ÓRFÃS EM ASSINATURAS JÁ ATIVAS (só cancelar):');
for (const o of ORFAS_SOLTAS) await cancelarOrfa(o.charge, o.nome);

if (!APPLY) console.log('\n(DRY-RUN: rode com --apply para aplicar.)');
