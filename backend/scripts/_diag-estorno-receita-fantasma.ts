/**
 * DIAGNÓSTICO (read-only) — pagamentos ESTORNADOS/CANCELADOS que ainda podem estar
 * contando como receita num caixa JÁ FECHADO (totais persistidos na coluna). É a
 * "receita fantasma" do relato: "só retornei o PIX pro cliente e entrou como
 * faturamento no caixa".
 *
 * O que faz: lista os payments com asaasStatus de não-receita (REFUNDED, etc.) que
 * têm um dia contábil (businessDate/paidAt) cujo cash_register está FECHADO. Para
 * cada caixa afetado, recalcula o totalRevenue "correto" (excluindo estornos) e
 * compara com o totalRevenue persistido — a diferença é o valor preso.
 *
 * NÃO altera nada. Para CORRIGIR, rode o reconcile-cash-registers.ts (recalcula e
 * persiste) ou aplique o webhook de estorno de novo. Daqui pra frente o próprio
 * handlePaymentRefunded já recalcula o caixa fechado.
 *
 * Uso: cd backend && npx tsx scripts/_diag-estorno-receita-fantasma.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { NON_REVENUE_ASAAS_STATUSES, isRevenuePayment } from '../src/common/business-date.helper';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function dayOf(p: { businessDate?: string | null; paidAt?: string | null }): string | null {
  const raw = p.businessDate ?? p.paidAt ?? null;
  return raw ? String(raw).substring(0, 10) : null;
}

function nextDay(dayStr: string): string {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function main() {
  // 1) Pagamentos em estado de não-receita (estorno/cancelamento/chargeback).
  const { data: refunded, error } = await sb
    .from('payments')
    .select('id, amount, method, asaasStatus, businessDate, paidAt, subscriptionId, appointmentId, clientId')
    .in('asaasStatus', NON_REVENUE_ASAAS_STATUSES as unknown as string[]);

  if (error) throw error;

  console.log(`\nPagamentos em estado de NÃO-receita: ${refunded?.length ?? 0}`);
  if (!refunded || refunded.length === 0) {
    console.log('Nenhum estorno/cancelamento registrado. Nada a corrigir.\n');
    return;
  }

  // 2) Agrupa por dia contábil e verifica o caixa daquele dia.
  const days = new Set<string>();
  for (const p of refunded) {
    const d = dayOf(p);
    if (d) days.add(d);
  }

  let phantomTotal = 0;
  const affected: string[] = [];

  for (const day of Array.from(days).sort()) {
    const { data: reg } = await sb
      .from('cash_registers')
      .select('id, isOpen, date, totalRevenue, totalPix, totalCard, totalCash')
      .gte('date', day)
      .lt('date', nextDay(day))
      .maybeSingle();

    if (!reg) continue; // sem caixa naquele dia → nada persistido

    // Recalcula a receita correta do dia (coalesce businessDate/paidAt, excluindo estornos).
    const start = `${day}T00:00:00`;
    const end = `${nextDay(day)}T00:00:00`;
    const { data: byBusiness } = await sb
      .from('payments')
      .select('amount, asaasStatus')
      .gte('businessDate', start)
      .lt('businessDate', end);
    const { data: byLegacy } = await sb
      .from('payments')
      .select('amount, asaasStatus')
      .is('businessDate', null)
      .gte('paidAt', start)
      .lt('paidAt', end);

    const correct = [...(byBusiness || []), ...(byLegacy || [])]
      .filter(isRevenuePayment)
      .reduce((s, p: any) => s + (p.amount || 0), 0);

    const persisted = reg.totalRevenue ?? null;
    const flag = reg.isOpen ? '(ABERTO: recalcula em tempo real, OK)' : '';
    const diff = persisted == null ? 0 : persisted - correct;

    if (!reg.isOpen && diff !== 0) {
      phantomTotal += diff;
      affected.push(
        `  ${day}  caixa=${reg.id}  persistido=R$${((persisted ?? 0) / 100).toFixed(2)}  correto=R$${(correct / 100).toFixed(2)}  FANTASMA=R$${(diff / 100).toFixed(2)}`,
      );
    } else {
      console.log(`  ${day}  caixa=${reg.id}  persistido=${persisted == null ? '—' : 'R$' + (persisted / 100).toFixed(2)}  correto=R$${(correct / 100).toFixed(2)}  ${flag}`);
    }
  }

  console.log(`\n--- Caixas FECHADOS com receita fantasma (estorno preso) ---`);
  if (affected.length === 0) {
    console.log('  Nenhum. Os caixas fechados já refletem os estornos.');
  } else {
    for (const a of affected) console.log(a);
    console.log(`\n  TOTAL preso em caixas fechados: R$${(phantomTotal / 100).toFixed(2)}`);
    console.log(`  Para corrigir: npx tsx scripts/reconcile-cash-registers.ts (recalcula e persiste).`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
