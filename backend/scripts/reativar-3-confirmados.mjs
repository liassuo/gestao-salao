// Reativa MANUALMENTE 3 assinaturas cujos donos CONFIRMARAM o pagamento e que foram
// verificadas 1 a 1 no Asaas (2026-06-15). Lista FIXA e determinística — NÃO varre o
// banco, só age sobre estes 3 ids. Idempotente. DRY-RUN por padrão; --apply escreve.
//
// Casos (todos com pagamento confirmado no Asaas):
//  - Lucas lima        (PENDING_PAYMENT) — pagou dívida R$70 PIX 15/06 (pay_fkanusw3casfp1wn)
//  - Paulo Sergio S.    (SUSPENDED)       — pagou dívida R$140 PIX 15/06 (pay_n702qf8f7ga91eyl)
//  - Paulo Henrique F.  (SUSPENDED)       — pagou R$159,90 PIX, mas o pagamento caiu num
//                                           customer Asaas trocado (cad. "fábio alves nunes",
//                                           pay_hvr27h7ko25rsc2o). Dono confirmou que é dele.
//
// O que faz por assinatura: reativa (ACTIVE, +1 mês, zera cortes) se ainda não-ACTIVE;
// quita as dívidas 'Cobrança não paga' abertas do cliente; recalcula hasDebts.
// NÃO cria pagamento novo (dobraria o caixa). Os 3 já têm um payment com subscriptionId
// no ciclo → isCurrentCyclePaid já enxerga (corte coberto). Não toca no caixa.
//
// Uso (a partir de backend/):
//   node scripts/reativar-3-confirmados.mjs           # DRY-RUN
//   node scripts/reativar-3-confirmados.mjs --apply   # ESCREVE

import 'dotenv/config';
const APPLY = process.argv.includes('--apply');
const SUPA_URL = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SKEY) { console.error('ABORTADO: Supabase ausente.'); process.exit(1); }
const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };

const TARGETS = [
  { name: 'Lucas lima',           subId: '3a85ba55-15fb-44a0-9a12-bee44160c24e' },
  { name: 'Paulo Sergio Santiago', subId: '423348c3-457e-4999-bc58-c8663d10c1ae' },
  { name: 'Paulo Henrique Freitas', subId: 'e5d51535-f3e2-4a10-9ce4-40044f3b09d8' },
];

async function sbget(table, params) {
  const u = new URL(SB + table);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: sh });
  if (!r.ok) throw new Error(`${table} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function sbpatch(table, filters, patch) {
  const u = new URL(SB + table);
  for (const [k, v] of Object.entries(filters)) u.searchParams.set(k, v);
  const r = await fetch(u, {
    method: 'PATCH',
    headers: { ...sh, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`patch ${table} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function main() {
  console.log(`===== REATIVAR 3 CONFIRMADOS — ${APPLY ? 'APPLY (ESCREVE)' : 'DRY-RUN'} =====\n`);
  const now = new Date();
  const end = new Date(now); end.setMonth(end.getMonth() + 1);
  const nowIso = now.toISOString();
  const endIso = end.toISOString();

  for (const t of TARGETS) {
    const sub = (await sbget('client_subscriptions', { select: 'id,clientId,status', id: 'eq.' + t.subId }))[0];
    if (!sub) { console.log(`  ${t.name}: assinatura ${t.subId} NÃO encontrada — pula`); continue; }

    const openDebts = await sbget('debts', {
      select: 'id,amount,remainingBalance', clientId: 'eq.' + sub.clientId,
      isSettled: 'eq.false', description: 'ilike.Cobrança não paga*',
    });
    // Confirma que existe payment vinculado ao ciclo (corte coberto). Apenas informativo.
    const linkedPays = await sbget('payments', {
      select: 'id,amount,paidAt', subscriptionId: 'eq.' + sub.id, paidAt: 'not.is.null',
    });

    console.log(`  ${t.name.padEnd(26)} status=${sub.status} | dívidas abertas: ${openDebts.length} (R$${(openDebts.reduce((s, d) => s + (d.remainingBalance ?? d.amount), 0) / 100).toFixed(2)}) | payment vinculado: ${linkedPays.length > 0 ? 'sim (ciclo pago)' : 'NÃO — checar'}`);

    if (!APPLY) continue;

    // 1) Reativa se ainda não-ACTIVE (idempotente: filtra status != ACTIVE não dá no PostgREST,
    //    então filtramos pelo id e só escrevemos se status atual não for ACTIVE).
    if (sub.status !== 'ACTIVE') {
      const rows = await sbpatch('client_subscriptions',
        { id: 'eq.' + sub.id, status: 'neq.ACTIVE' },
        { status: 'ACTIVE', cutsUsedThisMonth: 0, lastResetDate: nowIso, endDate: endIso, updatedAt: nowIso });
      console.log(`    reativada: ${Array.isArray(rows) && rows.length ? 'OK até ' + endIso.slice(0, 10) : 'no-op (já ACTIVE)'}`);
    } else {
      console.log(`    já ACTIVE — não reativa`);
    }

    // 2) Quita dívidas 'Cobrança não paga' abertas (idempotente: só isSettled=false).
    let settled = 0;
    for (const d of openDebts) {
      await sbpatch('debts', { id: 'eq.' + d.id, isSettled: 'eq.false' },
        { amountPaid: d.amount, remainingBalance: 0, isSettled: true, paidAt: nowIso, updatedAt: nowIso });
      settled++;
    }
    // 3) Recalcula hasDebts.
    const remaining = await sbget('debts', { select: 'id', clientId: 'eq.' + sub.clientId, isSettled: 'eq.false' });
    await sbpatch('clients', { id: 'eq.' + sub.clientId }, { hasDebts: remaining.length > 0 });
    console.log(`    dívidas quitadas: ${settled}; hasDebts agora=${remaining.length > 0}`);
  }

  console.log(`\n${APPLY ? 'Concluído.' : '(DRY-RUN: nada escrito. Rode com --apply para aplicar.)'}`);
}
main().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
