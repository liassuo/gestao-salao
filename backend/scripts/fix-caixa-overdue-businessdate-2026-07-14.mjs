// FIX 14/07/2026 — espelhos de cobrança vencida (paidAt NULL) com businessDate
// preenchido entravam na janela do caixa: inflavam a receita do dia com dinheiro
// que NÃO entrou e derrubavam a tela "Atendimentos do dia" no admin
// ("null is not an object (evaluating 'e.replace')" — relato do barbeiro 13-14/07).
//
// O que faz:
//   1. Zera o businessDate de payments com paidAt NULL e businessDate preenchido
//      (mesma regra do código novo: cobrança não paga fica fora do caixa até o
//      webhook de confirmação preencher paidAt+businessDate).
//   2. Recalcula os totais persistidos dos caixas FECHADOS dos dias afetados
//      (mesma matemática do CashRegisterService.recalcRegisterTotals).
//
// Depois de aplicar, rodar também a migração
//   backend/sql/alter_payments_businessdate_requires_paidat.sql
// no Supabase, para o banco passar a rejeitar a escrita errada.
//
// Uso:  node scripts/fix-caixa-overdue-businessdate-2026-07-14.mjs           (dry-run)
//       node scripts/fix-caixa-overdue-businessdate-2026-07-14.mjs --apply
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
};

// GET com defesa contra truncamento: o PostgREST limita a resposta ao max-rows do
// servidor (tip. 1000) SEM erro. Pedimos count=exact e abortamos se vier menos
// linha do que o total — melhor falhar do que persistir totais subcontados.
const sg = async (t, p) => {
  const u = new URL(SB + t);
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { ...sh, Prefer: 'count=exact' } });
  if (!r.ok) throw new Error(`GET ${t} ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  const range = r.headers.get('content-range'); // ex.: "0-24/25"
  const total = range ? Number(range.split('/')[1]) : NaN;
  if (Number.isFinite(total) && rows.length < total) {
    throw new Error(
      `GET ${t}: resposta truncada pelo PostgREST (${rows.length}/${total} linhas) — aborte e pagine.`,
    );
  }
  return rows;
};

const sp = async (t, p, body) => {
  const u = new URL(SB + t);
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { method: 'PATCH', headers: sh, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH ${t} ${r.status}: ${await r.text()}`);
};

// Hora LOCAL wall-clock (convenção do app — nowLocalIsoString; nunca toISOString,
// que é UTC e cai no dia errado depois das 21h em GMT-3).
const nowLocal = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Dia seguinte (YYYY-MM-DD) com aritmética puramente UTC — independe do fuso do host.
const nextDay = (d) => {
  const dt = new Date(d + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

// Status Asaas que tiram o pagamento da receita (espelha business-date.helper.ts).
const NON_REVENUE = new Set([
  'REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'DELETED', 'CANCELED',
  'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE',
]);
// Status que significam PAGO — um destes com paidAt null seria anomalia: não mexer.
const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

// 1) Espelhos não pagos com businessDate preenchido
const bad = await sg('payments', {
  select: 'id,amount,method,asaasStatus,asaasPaymentId,businessDate,paidAt,notes',
  paidAt: 'is.null',
  businessDate: 'not.is.null',
});
const targets = bad.filter((p) => !PAID_STATUSES.has(p.asaasStatus));
const skipped = bad.filter((p) => PAID_STATUSES.has(p.asaasStatus));
console.log(`Encontrados ${bad.length} payments com paidAt NULL + businessDate SET; ${targets.length} a corrigir.`);
for (const p of targets) {
  console.log(`  -> ${p.id} R$${(p.amount / 100).toFixed(2)} ${p.method} ${p.asaasStatus} dia=${String(p.businessDate).slice(0, 10)} "${(p.notes || '').slice(0, 50)}"`);
}
for (const p of skipped) {
  console.log(`  !! ANOMALIA (status pago com paidAt null — NÃO alterado; investigar e preencher paidAt pela data real do Asaas): ${p.id} ${p.asaasStatus}`);
}

const dias = [...new Set(targets.map((p) => String(p.businessDate).slice(0, 10)))];

if (APPLY) {
  for (const p of targets) {
    await sp('payments', { id: 'eq.' + p.id }, { businessDate: null, updatedAt: nowLocal() });
    console.log(`  OK businessDate=null em ${p.id}`);
  }
}

// 2) Recalcular caixas fechados dos dias afetados
for (const dia of dias) {
  const regs = await sg('cash_registers', {
    select: 'id,date,isOpen,openingBalance,closingBalance,totalCash,totalPix,totalCard,totalRevenue,discrepancy',
    date: 'gte.' + dia,
    and: `(date.lt.${nextDay(dia)})`,
  });
  for (const reg of regs) {
    if (reg.isOpen) {
      console.log(`Caixa ${dia} está ABERTO — totais são recalculados em tempo real, nada a persistir.`);
      continue;
    }
    // Mesma matemática do calculateDailyTotals (código novo):
    //   (a) businessDate no dia E paidAt preenchido; (b) businessDate null e paidAt no dia.
    const start = `${dia}T00:00:00`;
    const end = `${nextDay(dia)}T00:00:00`;
    const [byBusiness, byLegacy] = await Promise.all([
      sg('payments', {
        select: 'amount,method,asaasStatus',
        businessDate: `gte.${start}`,
        and: `(businessDate.lt.${end},paidAt.not.is.null)`,
      }),
      sg('payments', {
        select: 'amount,method,asaasStatus',
        businessDate: 'is.null',
        paidAt: `gte.${start}`,
        and: `(paidAt.lt.${end})`,
      }),
    ]);
    const totals = { cash: 0, pix: 0, card: 0, total: 0 };
    for (const p of [...byBusiness, ...byLegacy]) {
      if (p.asaasStatus && NON_REVENUE.has(p.asaasStatus)) continue;
      if (p.method === 'CASH') totals.cash += p.amount;
      else if (p.method === 'PIX') totals.pix += p.amount;
      else if (p.method === 'CARD') totals.card += p.amount;
      totals.total += p.amount;
    }
    const expectedClosing = (reg.openingBalance ?? 0) + totals.cash;
    const discrepancy = (reg.closingBalance ?? 0) - expectedClosing;
    console.log(`Caixa ${dia} (${reg.id}):`);
    console.log(`  antes : revenue=${reg.totalRevenue} cash=${reg.totalCash} pix=${reg.totalPix} card=${reg.totalCard} disc=${reg.discrepancy}`);
    console.log(`  depois: revenue=${totals.total} cash=${totals.cash} pix=${totals.pix} card=${totals.card} disc=${discrepancy}`);
    if (APPLY) {
      await sp('cash_registers', { id: 'eq.' + reg.id }, {
        totalCash: totals.cash,
        totalPix: totals.pix,
        totalCard: totals.card,
        totalRevenue: totals.total,
        discrepancy,
        updatedAt: nowLocal(),
      });
      console.log('  OK totais persistidos.');
    }
  }
}

console.log(APPLY ? '\nAPLICADO.' : '\nDRY-RUN (nada gravado). Rode com --apply para aplicar.');
