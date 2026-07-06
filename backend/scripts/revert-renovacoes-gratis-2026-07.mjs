// Reverte as RENOVAÇÕES GRÁTIS de julho/2026 (bug do piso do ciclo, "caso Kaio"):
// assinaturas que venceram no início de julho, foram suspensas pelo cron e, minutos
// depois, REATIVADAS +1 mês pela reconciliação usando a cobrança paga do ciclo
// ANTERIOR — sem nenhum pagamento novo (a dívida recém-criada foi quitada junto).
//
// O que faz, por assinatura alvo (revalidando TUDO ao vivo antes de escrever):
//  1. Confirma que está ACTIVE e que NÃO existe pagamento (local de receita ou
//     cobrança Asaas liquidada) desde endDate - 1 mês - 14 dias (janela do ciclo).
//     Se o cliente pagou nesse meio tempo → SKIP (não mexe).
//  2. status → SUSPENDED (cliente volta a ver "Reativar assinatura" no app; ao
//     reativar, paga E a recorrência Asaas é recriada — mata os 2 problemas).
//  3. Recria a dívida 'Cobrança não paga' do ciclo (se não houver uma em aberto)
//     e marca clients.hasDebts = true.
//
// ⚠️ PRÉ-REQUISITO: rodar SOMENTE depois do deploy do fix
// "reconciliacao nao reativa SUSPENDED com cobranca do ciclo vencido" — sem ele,
// o reconcile-cron desfaz a suspensão em ~10 minutos (foi assim que o bug agiu).
//
// Uso (a partir de backend/):
//   node scripts/revert-renovacoes-gratis-2026-07.mjs           # DRY-RUN
//   node scripts/revert-renovacoes-gratis-2026-07.mjs --apply   # ESCREVE

import 'dotenv/config';
import { randomUUID } from 'crypto';

const APPLY = process.argv.includes('--apply');

const SUPA_URL = process.env.SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ASAAS_API_KEY;
if (!SUPA_URL || !SKEY) { console.error('ABORTADO: Supabase ausente no .env.'); process.exit(1); }
if (!AKEY || !AKEY.startsWith('$aact_prod')) { console.error('ABORTADO: ASAAS_API_KEY ausente/não-prod.'); process.exit(1); }

// Assinaturas identificadas na varredura de 06/07/2026 (ACTIVE sem pagamento no ciclo).
const TARGET_SUB_IDS = [
  '25593c6a-cf51-430c-ab84-46a19c67bbf7', // JANDERSON LIMA BANDEIRA  R$140,00 venc 2026-08-02
  '65e585b2-1a8d-491c-a4b9-06b96ed96b58', // Kaio lima                R$140,00 venc 2026-08-04
  'b52315a6-4de6-4502-89e5-313113bdc2e7', // Kleudson Melo da Costa   R$159,90 venc 2026-08-06
  '6a63e31c-7d7b-4b65-8a80-b2792240c28a', // Lucas Gomes              R$ 70,00 venc 2026-08-06
  '179b4afc-0017-44e2-99f6-6c9917567cfc', // Vanderlan alves Martins  R$ 70,00 venc 2026-08-06
  '7f5e407c-6d66-431f-a79d-4e60f3ae5461', // Murilo Henrique          R$ 79,90 venc 2026-08-06
  '290c9cf1-2480-477f-92e8-4a861235f3e3', // Gustavo Lemos Quaranta   R$ 70,00 venc 2026-08-06
];

const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const NONREV = ['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'DELETED', 'CANCELED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'];
const DAY = 864e5;

async function sbget(table, params) {
  const u = new URL(SB + table);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: sh });
  if (!r.ok) throw new Error(`${table} GET ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function sbwrite(method, table, params, body) {
  const u = new URL(SB + table);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  const r = await fetch(u, {
    method,
    headers: { ...sh, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${table} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function main() {
  console.log(`===== REVERTER RENOVAÇÕES GRÁTIS 07/2026 — ${APPLY ? 'APPLY (ESCREVE)' : 'DRY-RUN'} =====\n`);
  let reverted = 0, skipped = 0, errors = 0;

  for (const subId of TARGET_SUB_IDS) {
    try {
      const [sub] = await sbget('client_subscriptions', {
        select: 'id,clientId,status,endDate,isComp,client:clients(name,asaasCustomerId),plan:subscription_plans!planId(name,price)',
        id: 'eq.' + subId,
      });
      const name = sub?.client?.name || subId;
      if (!sub) { console.log(`  SKIP  ${subId} — assinatura não encontrada`); skipped++; continue; }
      if (sub.status !== 'ACTIVE' || sub.isComp) {
        console.log(`  SKIP  ${name.padEnd(28)} — status=${sub.status}${sub.isComp ? ' (cortesia)' : ''} (não é o caso)`);
        skipped++; continue;
      }

      // Revalida AO VIVO: algum pagamento no ciclo corrente? (endDate - 1 mês - 14d)
      const endMs = new Date(sub.endDate || 0).getTime();
      const winStart = endMs - 30 * DAY - 14 * DAY;
      const pays = await sbget('payments', {
        select: 'paidAt,asaasStatus',
        subscriptionId: 'eq.' + subId,
        paidAt: 'not.is.null',
      });
      const localOk = pays.some((p) => {
        if (NONREV.includes(p.asaasStatus)) return false;
        const t = new Date(p.paidAt).getTime();
        return !Number.isNaN(t) && t >= winStart;
      });
      let asaasOk = false;
      if (!localOk && sub.client?.asaasCustomerId) {
        const r = await fetch(`https://api.asaas.com/v3/payments?customer=${sub.client.asaasCustomerId}&limit=100`, { headers: { access_token: AKEY } });
        const ch = r.ok ? await r.json() : { data: [] };
        asaasOk = (ch.data || []).some((c) => {
          if (!SETTLED.includes(c.status)) return false;
          const raw = c.paymentDate || c.confirmedDate || c.clientPaymentDate;
          if (!raw) return false;
          const t = new Date(String(raw).slice(0, 10) + 'T12:00:00').getTime();
          return !Number.isNaN(t) && t >= winStart;
        });
      }
      if (localOk || asaasOk) {
        console.log(`  SKIP  ${name.padEnd(28)} — PAGOU no ciclo corrente (não reverter)`);
        skipped++; continue;
      }

      const price = sub.plan?.price ?? 0;
      console.log(`  ALVO  ${name.padEnd(28)} | ${sub.plan?.name ?? ''} R$${(price / 100).toFixed(2)} | venc ${String(sub.endDate).slice(0, 10)} — sem pagamento no ciclo`);

      if (!APPLY) { reverted++; continue; }

      const now = new Date().toISOString();
      // 1) Suspender (só se ainda ACTIVE — idempotente).
      const rows = await sbwrite('PATCH', 'client_subscriptions',
        { id: 'eq.' + subId, status: 'eq.ACTIVE' },
        { status: 'SUSPENDED', updatedAt: now });
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log('        (já não estava ACTIVE — pulando dívida)');
        skipped++; continue;
      }

      // 2) Dívida do ciclo (dedup: só se não houver 'Cobrança não paga' em aberto).
      const open = await sbget('debts', {
        select: 'id',
        clientId: 'eq.' + sub.clientId,
        isSettled: 'eq.false',
        description: 'ilike.Cobrança não paga*',
        limit: '1',
      });
      if (open.length === 0 && price > 0) {
        const dueDate = new Date(Date.now() + 7 * DAY).toISOString();
        const cycleKey = String(sub.endDate ?? '').slice(0, 10);
        await sbwrite('POST', 'debts', {}, {
          id: randomUUID(),
          clientId: sub.clientId,
          amount: price,
          amountPaid: 0,
          remainingBalance: price,
          description: `Cobrança não paga — ${sub.plan?.name ?? 'Assinatura'} (PIX) [sub:${subId}:cycle:${cycleKey}]`,
          dueDate,
          isSettled: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      await sbwrite('PATCH', 'clients', { id: 'eq.' + sub.clientId }, { hasDebts: true });

      console.log(`        OK — SUSPENDED + dívida ${open.length === 0 ? 'criada' : 'já existia'} + hasDebts=true`);
      reverted++;
    } catch (e) {
      console.log(`  ERRO  ${subId} — ${e.message}`);
      errors++;
    }
  }

  console.log(`\n${APPLY ? 'Revertidas' : 'A reverter'}: ${reverted} | Puladas: ${skipped} | Erros: ${errors}`);
  if (!APPLY) console.log('\n(DRY-RUN: nada escrito. RODE SÓ DEPOIS DO DEPLOY DO FIX, com --apply.)');
}
main().catch((e) => { console.error('FALHA GERAL:', e.message); process.exit(1); });
