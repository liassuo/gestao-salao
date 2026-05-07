/**
 * Reconciliação dos cash_registers e payments após o fix do bug
 * "calculateDailyTotals com coluna asaasStatus inexistente".
 *
 * O que faz (idempotente):
 *   1. Para cada cash_register fechado: recalcula totalCash/Pix/Card/Revenue
 *      e discrepancy somando payments do dia. Aplica UPDATE.
 *   2. Para cada payment com cashRegisterId=NULL e paidAt dentro do dia
 *      de algum cash_register: vincula.
 *
 * Modos:
 *   --dry-run (padrão): só imprime o que faria
 *   --apply           : executa os UPDATEs
 *
 * IMPORTANTE: rodar APENAS DEPOIS de aplicar a SQL migration
 *   backend/sql/alter_payments_add_asaas_columns.sql
 *
 * Uso:
 *   cd backend
 *   npx tsx scripts/reconcile-cash-registers.ts            # dry-run
 *   npx tsx scripts/reconcile-cash-registers.ts --apply    # executa
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function brl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

async function calculateTotalsForDate(dateStr: string) {
  const startOfDay = `${dateStr}T00:00:00`;
  const endOfDay = `${dateStr}T23:59:59`;

  const { data: payments, error } = await sb
    .from('payments')
    .select('id, amount, method, asaasStatus, paidAt')
    .gte('paidAt', startOfDay)
    .lte('paidAt', endOfDay);

  if (error) throw new Error(`Erro ao buscar payments para ${dateStr}: ${error.message}`);

  const totals = { cash: 0, pix: 0, card: 0, total: 0, count: 0, ignored: 0 };
  for (const p of payments || []) {
    if (p.asaasStatus && ['REFUNDED', 'DELETED', 'CANCELED'].includes(p.asaasStatus)) {
      totals.ignored++;
      continue;
    }
    switch (p.method) {
      case 'CASH': totals.cash += p.amount; break;
      case 'PIX': totals.pix += p.amount; break;
      case 'CARD': totals.card += p.amount; break;
    }
    totals.total += p.amount;
    totals.count++;
  }
  return totals;
}

async function reconcileCashRegisters() {
  console.log('\n=== ETAPA 1: Recalcular totais de cash_registers fechados ===\n');

  const { data: registers, error } = await sb
    .from('cash_registers')
    .select('id, date, isOpen, openingBalance, closingBalance, totalCash, totalPix, totalCard, totalRevenue, discrepancy')
    .eq('isOpen', false)
    .order('date', { ascending: true });

  if (error) throw error;

  for (const reg of registers || []) {
    const dateStr = reg.date.substring(0, 10);
    const totals = await calculateTotalsForDate(dateStr);
    const expectedClosing = (reg.openingBalance ?? 0) + totals.cash;
    const newDiscrepancy = (reg.closingBalance ?? 0) - expectedClosing;

    const changed =
      (reg.totalCash ?? 0) !== totals.cash ||
      (reg.totalPix ?? 0) !== totals.pix ||
      (reg.totalCard ?? 0) !== totals.card ||
      (reg.totalRevenue ?? 0) !== totals.total ||
      (reg.discrepancy ?? 0) !== newDiscrepancy;

    if (!changed) {
      console.log(`  [OK]   ${dateStr} (${reg.id.slice(0, 8)}) já consistente — receita ${brl(totals.total)}`);
      continue;
    }

    console.log(`  [DIFF] ${dateStr} (${reg.id.slice(0, 8)})`);
    console.log(`         cash:    ${brl(reg.totalCash ?? 0)} → ${brl(totals.cash)}`);
    console.log(`         pix:     ${brl(reg.totalPix ?? 0)} → ${brl(totals.pix)}`);
    console.log(`         card:    ${brl(reg.totalCard ?? 0)} → ${brl(totals.card)}`);
    console.log(`         total:   ${brl(reg.totalRevenue ?? 0)} → ${brl(totals.total)}`);
    console.log(`         disc:    ${brl(reg.discrepancy ?? 0)} → ${brl(newDiscrepancy)}`);
    console.log(`         (${totals.count} pagamentos contabilizados, ${totals.ignored} ignorados por refund/cancel)`);

    if (APPLY) {
      const { error: upErr } = await sb
        .from('cash_registers')
        .update({
          totalCash: totals.cash,
          totalPix: totals.pix,
          totalCard: totals.card,
          totalRevenue: totals.total,
          discrepancy: newDiscrepancy,
        })
        .eq('id', reg.id);
      if (upErr) console.error(`         ERRO ao atualizar: ${upErr.message}`);
      else console.log(`         APLICADO`);
    }
  }
}

async function backfillCashRegisterIds() {
  console.log('\n=== ETAPA 2: Vincular cashRegisterId em payments órfãos ===\n');

  // Mapa data -> registerId
  const { data: registers } = await sb
    .from('cash_registers')
    .select('id, date');
  const dateToRegister: Record<string, string> = {};
  for (const r of registers || []) {
    const dateStr = r.date.substring(0, 10);
    if (!dateToRegister[dateStr]) dateToRegister[dateStr] = r.id;
  }

  const { data: orphanPayments } = await sb
    .from('payments')
    .select('id, paidAt, amount, method, cashRegisterId')
    .is('cashRegisterId', null)
    .not('paidAt', 'is', null)
    .order('paidAt', { ascending: true });

  let linked = 0, skipped = 0;
  for (const p of orphanPayments || []) {
    const dayStr = p.paidAt.substring(0, 10);
    const registerId = dateToRegister[dayStr];
    if (!registerId) {
      skipped++;
      console.log(`  [SKIP] ${p.id.slice(0, 8)} paidAt=${p.paidAt} ${p.method} ${brl(p.amount)} — sem caixa em ${dayStr}`);
      continue;
    }
    console.log(`  [LINK] ${p.id.slice(0, 8)} paidAt=${p.paidAt} ${p.method} ${brl(p.amount)} → caixa ${registerId.slice(0, 8)} (${dayStr})`);
    if (APPLY) {
      const { error } = await sb
        .from('payments')
        .update({ cashRegisterId: registerId })
        .eq('id', p.id);
      if (error) console.error(`         ERRO: ${error.message}`);
    }
    linked++;
  }

  console.log(`\n  Resumo etapa 2: ${linked} vincular, ${skipped} sem caixa correspondente.`);
}

async function backfillOrderPaymentIds() {
  console.log('\n=== ETAPA 2b: Backfill de orders.paymentId ===\n');

  const { data: orphans } = await sb
    .from('orders')
    .select('id, totalAmount, appointmentId, updatedAt')
    .eq('status', 'PAID')
    .is('paymentId', null)
    .gt('totalAmount', 0)
    .order('updatedAt', { ascending: false });

  let linked = 0, ambiguous = 0, missing = 0;
  for (const o of orphans || []) {
    if (!o.appointmentId) {
      missing++;
      console.log(`  [SKIP] order=${o.id.slice(0, 8)} R$${(o.totalAmount/100).toFixed(2)} sem appointmentId — não dá pra vincular automaticamente`);
      continue;
    }

    const { data: payments } = await sb
      .from('payments')
      .select('id, amount, paidAt')
      .eq('appointmentId', o.appointmentId)
      .not('paidAt', 'is', null);

    if (!payments || payments.length === 0) {
      missing++;
      console.log(`  [MISS] order=${o.id.slice(0, 8)} R$${(o.totalAmount/100).toFixed(2)} appt=${o.appointmentId.slice(0, 8)} — sem payment registrado (RECEITA PERDIDA)`);
      continue;
    }

    if (payments.length > 1) {
      ambiguous++;
      console.log(`  [AMB]  order=${o.id.slice(0, 8)} appt=${o.appointmentId.slice(0, 8)} — ${payments.length} payments, escolhendo o de mesmo amount ou primeiro`);
    }

    const match = payments.find(p => p.amount === o.totalAmount) || payments[0];
    console.log(`  [LINK] order=${o.id.slice(0, 8)} → payment=${match.id.slice(0, 8)} R$${(match.amount/100).toFixed(2)}`);

    if (APPLY) {
      const { error } = await sb
        .from('orders')
        .update({ paymentId: match.id })
        .eq('id', o.id);
      if (error) console.error(`         ERRO: ${error.message}`);
    }
    linked++;
  }

  console.log(`\n  Resumo etapa 2b: ${linked} a vincular, ${ambiguous} ambíguos (resolvidos), ${missing} sem payment correspondente.`);
}

async function detectAnomalies() {
  console.log('\n=== ETAPA 3: Detectar anomalias (apenas relatório) ===\n');

  // 1. Orders PAID sem paymentId
  const { data: ordersNoPayment } = await sb
    .from('orders')
    .select('id, totalAmount, appointmentId, updatedAt, consumerType')
    .eq('status', 'PAID')
    .is('paymentId', null)
    .gt('totalAmount', 0)
    .order('updatedAt', { ascending: false })
    .limit(100);
  console.log(`  Orders PAID sem paymentId (totalAmount>0): ${ordersNoPayment?.length || 0}`);

  // 2. Appointments isPaid=true sem payment
  const { data: paidAppts } = await sb
    .from('appointments')
    .select('id, totalPrice, scheduledAt')
    .eq('isPaid', true)
    .gt('totalPrice', 0)
    .gte('scheduledAt', '2026-04-01T00:00:00')
    .order('scheduledAt', { ascending: false });

  let orphanCount = 0;
  for (const a of paidAppts || []) {
    const { data: ps } = await sb
      .from('payments')
      .select('id')
      .eq('appointmentId', a.id)
      .not('paidAt', 'is', null);
    if (!ps || ps.length === 0) orphanCount++;
  }
  console.log(`  Appointments isPaid=true sem payment com paidAt: ${orphanCount}`);

  // 3. Cash registers com >1 aberto
  const { data: openRegisters } = await sb
    .from('cash_registers')
    .select('id, date, openedAt')
    .eq('isOpen', true);
  console.log(`  Cash registers abertos simultaneamente: ${openRegisters?.length || 0}`);
  if ((openRegisters?.length || 0) > 1) {
    openRegisters?.forEach(r => console.log(`     ${r.id} | date=${r.date} | abriu ${r.openedAt}`));
  }
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY (vai gravar)' : 'DRY-RUN (só relatório, use --apply para gravar)'}`);
  await reconcileCashRegisters();
  await backfillCashRegisterIds();
  await backfillOrderPaymentIds();
  await detectAnomalies();
  console.log('\nFim.');
}

main().catch((e) => {
  console.error('FALHOU:', e);
  process.exit(1);
});
