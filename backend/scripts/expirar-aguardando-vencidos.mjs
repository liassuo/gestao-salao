// Expira assinaturas presas em "Aguardando Pagamento" (PENDING_PAYMENT) ou SUSPENDED
// que estão há mais de N dias sem pagamento — elas entopem a lista e não vão pagar.
// Vira EXPIRED (sai de Ativas e de Aguardando; fica no histórico; reativável).
//
// CRITÉRIO: status PENDING_PAYMENT/SUSPENDED E último pagamento (se houver) + 30 dias
// já venceu há mais de GRACE_DAYS. Ou seja, o mês pago acabou e passou a tolerância.
//
// SEGURANÇA: só expira quem NÃO tem pagamento dentro do ciclo vigente (não expira quem
// pagou e está válido). Dry-run por padrão.
//
// Uso (a partir de backend/):
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/expirar-aguardando-vencidos.mjs          # DRY-RUN
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/expirar-aguardando-vencidos.mjs --apply

import 'dotenv/config';
const APPLY = process.argv.includes('--apply');
const GRACE_DAYS = 15; // dias após o vencimento do mês pago antes de expirar
const SUPA = process.env.SUPABASE_URL, SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY, AKEY = process.env.ASAAS_PROD_KEY;
if (!SUPA || !SKEY) { console.error('ABORTADO: Supabase ausente.'); process.exit(1); }
if (!AKEY || !AKEY.startsWith('$aact_prod')) { console.error('ABORTADO: ASAAS_PROD_KEY ausente/não-prod.'); process.exit(1); }
const SB = SUPA.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const NOW = new Date();

const sg = async (t, p) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); return r.json(); };
const sbpatch = async (t, filt, body) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(filt)) u.searchParams.set(k, v); const r = await fetch(u, { method: 'PATCH', headers: { ...sh, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`patch ${t} ${r.status} ${(await r.text()).slice(0, 150)}`); return r.json(); };
const ag = async (p) => { const r = await fetch('https://api.asaas.com/v3/' + p, { headers: { access_token: AKEY } }); return r.ok ? r.json() : { data: [] }; };

async function main() {
  console.log(`===== EXPIRAR AGUARDANDO VENCIDOS (>${GRACE_DAYS}d) — ${APPLY ? 'APPLY' : 'DRY-RUN'} =====\n`);
  const subs = await sg('client_subscriptions', {
    select: 'id,clientId,status,startDate,endDate,createdAt,client:clients(name,asaasCustomerId),plan:subscription_plans!planId(name,price)',
    status: 'in.(PENDING_PAYMENT,SUSPENDED)', order: 'createdAt.desc',
  });
  console.log(`PENDING_PAYMENT/SUSPENDED no total: ${subs.length}\n`);

  let expirar = 0, manter = 0;
  for (const s of subs) {
    const nome = s.client?.name || '?';
    // último pagamento liquidado (data real) — do nosso banco E do Asaas
    let datas = [];
    const localPays = await sg('payments', { select: 'paidAt', subscriptionId: 'eq.' + s.id, paidAt: 'not.is.null' });
    datas.push(...localPays.map((p) => p.paidAt));
    if (s.client?.asaasCustomerId) {
      const ch = (await ag(`payments?customer=${s.client.asaasCustomerId}&limit=100`)).data || [];
      datas.push(...ch.filter((c) => SETTLED.includes(c.status)).map((c) => c.confirmedDate || c.clientPaymentDate || c.paymentDate));
    }
    datas = datas.filter(Boolean).sort();
    const ultPag = datas[datas.length - 1] || null;

    // vencimento do mês pago = último pagamento + 30 dias; sem pagamento = createdAt
    const base = ultPag ? new Date(ultPag) : new Date(s.createdAt);
    const vencMes = new Date(base); if (ultPag) vencMes.setDate(vencMes.getDate() + 30);
    const diasVencido = Math.floor((NOW - vencMes) / 864e5);

    if (diasVencido > GRACE_DAYS) {
      console.log(`  EXPIRAR  ${nome.padEnd(26)} ${s.status.slice(0, 7)} | ${ultPag ? 'pagou ' + ultPag.slice(0, 10) : 'NUNCA pagou'} | vencido há ${diasVencido}d`);
      expirar++;
      if (APPLY) {
        await sbpatch('client_subscriptions', { id: 'eq.' + s.id, status: `in.(PENDING_PAYMENT,SUSPENDED)` }, { status: 'EXPIRED', updatedAt: NOW.toISOString() });
      }
    } else {
      console.log(`  manter   ${nome.padEnd(26)} ${s.status.slice(0, 7)} | ${ultPag ? 'pagou ' + ultPag.slice(0, 10) : 'NUNCA pagou'} | vencido há ${diasVencido}d (dentro da tolerância)`);
      manter++;
    }
  }
  console.log(`\n${APPLY ? 'Expiradas' : 'A expirar'}: ${expirar} | Mantidas: ${manter}`);
  if (!APPLY) console.log('(DRY-RUN: nada escrito.)');
}
main().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
