// CONTAGEM (read-only, NÃO escreve nada) — dimensiona o problema "Ativo + Ciclo não pago".
//
// Assinatura ACTIVE (não vencida) cujo CICLO VIGENTE não tem pagamento vinculado
// (nenhum payment com subscriptionId=sub.id e paidAt dentro do ciclo) é tratada
// como NÃO-assinante pelo gate isCurrentCyclePaid → a comanda cobra o corte cheio
// e o app mostra "Ciclo não pago". Inclui o caso do cliente que reativou pagando a
// dívida (o pagamento DEBT_PAYMENT não tem subscriptionId).
//
// Espelha FIELMENTE pricing.helper.ts:isCurrentCyclePaid:
//   cycleStart = max(startDate, createdAt)
//   cycleFloor = (cycleStart - 1 dia) normalizado p/ 00:00:00 UTC
//   pago = existe payment com subscriptionId=sub.id, paidAt != null, paidAt >= cycleFloor
// E o gate getActiveClientSubscription: ignora assinatura cujo endDate já venceu.
//
// Para os NÃO-pagos, tenta detectar se há um pagamento de DÍVIDA (DEBT_PAYMENT)
// liquidado do cliente — esses são os que a correção "carimbar o pagamento" resolve.
//
// Uso (a partir de backend/):  node scripts/count-active-ciclo-nao-pago.mjs

import 'dotenv/config';

const SUPA_URL = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SKEY) {
  console.error('ABORTADO: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.');
  process.exit(1);
}
const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

async function sbget(table, params) {
  const u = new URL(SB + table);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: sh });
  if (!r.ok) throw new Error(`${table} GET ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Réplica exata de isCurrentCyclePaid (pricing.helper.ts:98-130).
function cycleFloorMs(startDate, createdAt) {
  const startMs = startDate ? new Date(startDate).getTime() : 0;
  const createdMs = createdAt ? new Date(createdAt).getTime() : 0;
  const cycleStartMs = Math.max(startMs, createdMs);
  const ONE_DAY = 24 * 60 * 60 * 1000;
  return cycleStartMs > 0 ? new Date(cycleStartMs - ONE_DAY).setUTCHours(0, 0, 0, 0) : 0;
}

async function main() {
  console.log('===== CONTAGEM: assinaturas ATIVAS com "Ciclo não pago" (read-only) =====\n');
  const nowMs = Date.now();

  const subs = await sbget('client_subscriptions', {
    select: 'id,clientId,startDate,endDate,createdAt,client:clients(name),plan:subscription_plans!planId(name,price)',
    status: 'eq.ACTIVE',
    order: 'createdAt.desc',
  });

  let active = 0, expiredSkipped = 0, paid = 0, unpaid = 0, unpaidWithDebtPay = 0;
  const unpaidList = [];

  for (const s of subs) {
    active++;
    // Gate getActiveClientSubscription: assinatura vencida é tratada como não-assinante,
    // não entra nessa medição (não é o caso "ativo+ciclo não pago", é "vencida").
    if (s.endDate && new Date(s.endDate).getTime() <= nowMs) {
      expiredSkipped++;
      continue;
    }

    const floor = cycleFloorMs(s.startDate, s.createdAt);
    const pays = await sbget('payments', {
      select: 'paidAt',
      subscriptionId: 'eq.' + s.id,
      paidAt: 'not.is.null',
    });
    const isPaid = pays.some((p) => {
      const ms = new Date(p.paidAt).getTime();
      return !Number.isNaN(ms) && ms >= floor;
    });

    if (isPaid) { paid++; continue; }

    unpaid++;
    // Esse cliente reativou pagando dívida? Procura DEBT_PAYMENT liquidado dele.
    const debtPays = await sbget('payments', {
      select: 'asaasPaymentId,asaasStatus,paidAt',
      clientId: 'eq.' + s.clientId,
      notes: 'eq.DEBT_PAYMENT',
    });
    const hasSettledDebtPay = debtPays.some((p) => SETTLED.includes(p.asaasStatus) && p.paidAt);
    if (hasSettledDebtPay) unpaidWithDebtPay++;

    unpaidList.push({
      name: s.client?.name || '?',
      plan: s.plan?.name || '?',
      price: s.plan?.price ?? null,
      subId: s.id,
      clientId: s.clientId,
      cycleFloor: new Date(floor).toISOString().slice(0, 10),
      paidViaDebt: hasSettledDebtPay,
    });
  }

  console.log(`Assinaturas ACTIVE no total: ${active}`);
  console.log(`  - vencidas (endDate passado, fora desta medição): ${expiredSkipped}`);
  console.log(`  - ATIVAS válidas: ${active - expiredSkipped}`);
  console.log(`     -> ciclo PAGO (ok): ${paid}`);
  console.log(`     -> ciclo NÃO pago (cobra corte cheio): ${unpaid}`);
  console.log(`          dos quais reativaram pagando DÍVIDA (correção resolve): ${unpaidWithDebtPay}`);
  console.log(`          sem pagamento de dívida detectado (outra origem): ${unpaid - unpaidWithDebtPay}`);

  console.log('\n--- LISTA (ciclo não pago) ---');
  for (const u of unpaidList) {
    const v = u.price != null ? `R$${(u.price / 100).toFixed(2)}` : '?';
    console.log(`  ${u.name.padEnd(26)} ${u.plan.padEnd(30)} ${v.padStart(9)} | pisoCiclo ${u.cycleFloor} | ${u.paidViaDebt ? 'PAGOU DÍVIDA' : 'sem debt-pay'} | ${u.subId}`);
  }

  console.log('\n--- RESUMO JSON ---');
  console.log(JSON.stringify({
    activeTotal: active, expiredSkipped, activeValid: active - expiredSkipped,
    cyclePaid: paid, cycleUnpaid: unpaid, cycleUnpaidViaDebt: unpaidWithDebtPay,
  }, null, 2));
  console.log('\n(READ-ONLY: nada foi escrito.)');
}
main().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
