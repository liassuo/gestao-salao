// AUDITORIA read-only (NÃO escreve nada). Cruza banco (Supabase) x Asaas e lista
// TODOS os clientes afetados pelos problemas de assinatura. Roda com a chave de prod.
//
// 3 listas:
//  LISTA 1 "PAGOU MAS PRESO": assinatura SUSPENDED/PENDING_PAYMENT cujo cliente TEM
//          cobrança liquidada no Asaas cobrindo o ciclo (pagou e não ativou). Procura
//          inclusive em customers Asaas DUPLICADOS (mesmo CPF/telefone).
//  LISTA 2 "CARTÃO SEM RECORRÊNCIA": assinatura ACTIVE/SUSPENDED no cartão sem
//          asaasSubscriptionId (não vai renovar sozinha).
//  LISTA 3 "CICLO NÃO PAGO": assinatura ACTIVE não-vencida sem payment vinculado no
//          ciclo (isCurrentCyclePaid=false → comanda cobra o corte cheio).
//
// Uso (a partir de backend/):
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/audit-assinaturas.mjs

import 'dotenv/config';
const SUPA_URL = process.env.SUPABASE_URL, SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY, AKEY = process.env.ASAAS_PROD_KEY;
if (!SUPA_URL || !SKEY) { console.error('ABORTADO: Supabase ausente.'); process.exit(1); }
if (!AKEY || !AKEY.startsWith('$aact_prod')) { console.error('ABORTADO: ASAAS_PROD_KEY ausente/não-prod.'); process.exit(1); }
const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

const sg = async (t, p) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); if (!r.ok) throw new Error(`${t} ${r.status}`); return r.json(); };
const ag = async (path) => { const r = await fetch('https://api.asaas.com/v3/' + path, { headers: { access_token: AKEY } }); return r.ok ? r.json() : { data: [] }; };
const onlyDigits = (s) => (s || '').replace(/\D/g, '');
const reais = (cent) => 'R$' + ((cent || 0) / 100).toFixed(2);

// Réplica de isCurrentCyclePaid (pricing.helper.ts).
function cycleFloorMs(startDate, createdAt) {
  const a = startDate ? new Date(startDate).getTime() : 0, b = createdAt ? new Date(createdAt).getTime() : 0;
  const s = Math.max(a, b); const D = 864e5;
  return s > 0 ? new Date(s - D).setUTCHours(0, 0, 0, 0) : 0;
}

async function main() {
  console.log('===== AUDITORIA ASSINATURAS (read-only) — ' + new Date().toISOString().slice(0, 16) + ' =====\n');
  const nowMs = Date.now();

  const subs = await sg('client_subscriptions', {
    select: 'id,clientId,status,startDate,endDate,createdAt,asaasSubscriptionId,client:clients(id,name,phone,asaasCustomerId),plan:subscription_plans!planId(name,price)',
    order: 'createdAt.desc',
  });

  // Cache de cobranças por asaasCustomerId (evita repetir chamadas).
  const chargeCache = new Map();
  const getCharges = async (cusId) => {
    if (!cusId) return [];
    if (chargeCache.has(cusId)) return chargeCache.get(cusId);
    const j = await ag(`payments?customer=${cusId}&limit=100`);
    const data = j.data || [];
    chargeCache.set(cusId, data);
    return data;
  };

  const L1 = [], L2 = [], L3 = [];

  for (const s of subs) {
    const cli = s.client || {};
    const planName = s.plan?.name || '?';
    const tag = `${(cli.name || '?').padEnd(26)} ${planName.slice(0, 24).padEnd(24)} ${reais(s.plan?.price).padStart(9)}`;

    // ---- LISTA 1: pagou mas preso (SUSPENDED / PENDING_PAYMENT) ----
    if (s.status === 'SUSPENDED' || s.status === 'PENDING_PAYMENT') {
      let charges = await getCharges(cli.asaasCustomerId);
      // Procura cobrança liquidada recente (>= criação da assinatura - margem) que cubra o plano.
      const subCreatedMs = new Date(s.createdAt).getTime();
      const cover = (s.plan?.price ?? 0);
      let paid = charges.find((c) => SETTLED.includes(c.status) && Math.round(Number(c.value) * 100) >= cover &&
        new Date(c.confirmedDate || c.paymentDate || c.clientPaymentDate || 0).getTime() >= subCreatedMs - 2 * 864e5);
      let viaDup = false;
      // Se não achou, procura customers Asaas duplicados (mesmo telefone) e tenta de novo.
      if (!paid && cli.phone) {
        const dupCustomers = (await ag(`customers?mobilePhone=${onlyDigits(cli.phone)}&limit=10`)).data || [];
        for (const dc of dupCustomers) {
          if (dc.id === cli.asaasCustomerId) continue;
          const dcharges = await getCharges(dc.id);
          const p = dcharges.find((c) => SETTLED.includes(c.status) && Math.round(Number(c.value) * 100) >= cover &&
            new Date(c.confirmedDate || c.paymentDate || 0).getTime() >= subCreatedMs - 2 * 864e5);
          if (p) { paid = p; viaDup = dc.name; break; }
        }
      }
      if (paid) {
        L1.push(`  ${tag} | ${s.status} | PAGO ${reais(Math.round(paid.value * 100))} ${paid.billingType} ${(paid.confirmedDate || paid.paymentDate)} ${viaDup ? '⚠DUPLICADO:' + viaDup : ''} | sub=${s.id}`);
      }
    }

    // ---- LISTA 2: cartão sem recorrência (ACTIVE/SUSPENDED) ----
    if ((s.status === 'ACTIVE' || s.status === 'SUSPENDED') && !s.asaasSubscriptionId) {
      // método: olha o último payment do cliente p/ inferir CARD (heurística leve)
      const lastPays = await sg('payments', { select: 'method,createdAt', subscriptionId: 'eq.' + s.id, order: 'createdAt.desc', limit: '1' });
      const method = lastPays[0]?.method || '?';
      L2.push(`  ${tag} | ${s.status} | método=${method} | SEM recorrência Asaas | sub=${s.id}`);
    }

    // ---- LISTA 3: ACTIVE não-vencida com ciclo não pago ----
    if (s.status === 'ACTIVE' && !(s.endDate && new Date(s.endDate).getTime() <= nowMs)) {
      const floor = cycleFloorMs(s.startDate, s.createdAt);
      const pays = await sg('payments', { select: 'paidAt', subscriptionId: 'eq.' + s.id, paidAt: 'not.is.null' });
      const isPaid = pays.some((p) => { const m = new Date(p.paidAt).getTime(); return !Number.isNaN(m) && m >= floor; });
      if (!isPaid) L3.push(`  ${tag} | venc ${String(s.endDate).slice(0, 10)} | sub=${s.id}`);
    }
  }

  console.log(`\n######## LISTA 1 — PAGOU MAS PRESO (${L1.length}) ########`);
  L1.forEach((x) => console.log(x));
  console.log(`\n######## LISTA 2 — CARTÃO/SEM RECORRÊNCIA no Asaas (${L2.length}) ########`);
  L2.forEach((x) => console.log(x));
  console.log(`\n######## LISTA 3 — ATIVO + CICLO NÃO PAGO (${L3.length}) ########`);
  L3.forEach((x) => console.log(x));

  console.log(`\n===== RESUMO: presos=${L1.length} | sem-recorrência=${L2.length} | ciclo-não-pago=${L3.length} | total assinaturas=${subs.length} =====`);
  console.log('(READ-ONLY: nada foi escrito.)');
}
main().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
