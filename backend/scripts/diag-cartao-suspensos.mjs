// READ-ONLY. Para os clientes de CARTÃO que estão Suspensos/Inadimplentes, verifica no
// Asaas: tem recorrência? de que tipo (CREDIT_CARD = cobra sozinho / UNDEFINED = não)?
// tem cartão tokenizado? por que não renovou?
import 'dotenv/config';
const AKEY = process.env.ASAAS_PROD_KEY;
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY };
const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const ag = async (p) => { const r = await fetch('https://api.asaas.com/v3/' + p, { headers: { access_token: AKEY } }); return r.ok ? r.json() : { data: [] }; };
const sg = async (t, p) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); return r.json(); };

const NOMES = ['marcos carvalho', 'DAVI PEREIRA', 'Isaías Souza', 'Julyo Cesar', 'João Marcos Fernandes', 'Gabriel Fernandes Marra', 'wedisney'];

(async () => {
  for (const nome of NOMES) {
    const cs = await sg('clients', { select: 'id,name,asaasCustomerId', name: `ilike.*${nome.split(' ')[0]}*` });
    const c = cs.find((x) => nome.toLowerCase().split(' ').slice(0, 2).every((w) => x.name.toLowerCase().includes(w))) || cs[0];
    if (!c) { console.log(`\n${nome}: não achado`); continue; }
    console.log(`\n### ${c.name} | cus=${c.asaasCustomerId || 'nenhum'}`);
    if (!c.asaasCustomerId) { console.log('   sem customer Asaas'); continue; }
    // recorrências
    const subs = (await ag(`subscriptions?customer=${c.asaasCustomerId}&limit=20`)).data || [];
    for (const s of subs) console.log(`   RECORRÊNCIA ${s.id} status=${s.status} billingType=${s.billingType} next=${s.nextDueDate}`);
    if (!subs.length) console.log('   SEM recorrência no Asaas');
    // pagamentos
    const ch = (await ag(`payments?customer=${c.asaasCustomerId}&limit=100`)).data || [];
    const pagas = ch.filter((x) => SETTLED.includes(x.status));
    const ult = pagas.map((x) => x.confirmedDate || x.clientPaymentDate || x.paymentDate).filter(Boolean).sort().pop();
    console.log(`   pagamentos: ${pagas.length} (último ${ult || '-'}) | tem token cartão? ${ch.some((x) => x.creditCard?.creditCardToken) ? 'SIM' : 'não detectado'}`);
    // cobranças em aberto
    const abertas = ch.filter((x) => x.status === 'OVERDUE' || x.status === 'PENDING');
    for (const x of abertas) console.log(`   EM ABERTO: R$${x.value} ${x.billingType} ${x.status} venc=${x.dueDate}`);
  }
  console.log('\n(READ-ONLY)');
})().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
