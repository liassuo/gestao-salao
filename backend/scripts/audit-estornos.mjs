// AUDITORIA read-only (NÃO escreve nada). Investiga a queixa "o app estornou e o
// barbeiro recobrou na maquininha". Roda com a chave de prod.
//
// POR QUE auditoria por status LOCAL não bastava: quando o app EXCLUI a cobrança
// (DELETE /payments), o Asaas dispara PAYMENT_DELETED — evento DESMARCADO no painel —
// então handlePaymentDeleted nunca roda e o `payments.asaasStatus` LOCAL fica velho.
// Aqui consultamos o Asaas DIRETO.
//
// 3 passes:
//  PASS 0 — ASAAS DIRETO (autoritativo): lista TODOS os pagamentos REFUNDED /
//           REFUND_IN_PROGRESS da conta Asaas no período. Se vier vazio, NÃO houve
//           estorno pelo Asaas — ponto. Independe do banco e do webhook.
//  PASS A — DRIFT: para TODO pagamento local com asaasPaymentId no período, consulta
//           o charge real e sinaliza deleted / refunded / refunds[] (pega cobrança
//           que o app excluiu sem o banco refletir).
//  PASS B — DUPLO PAGAMENTO (só banco): mesmo cliente com cobrança Asaas E pagamento
//           de maquininha (sem asaasPaymentId) no mesmo dia/agendamento. Digital de
//           "estornou no app, recobrou na maquininha".
//
// Uso (a partir de backend/):
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/audit-estornos.mjs
//   DESDE=2026-01-01 ASAAS_PROD_KEY='$aact_prod_...' node scripts/audit-estornos.mjs  # default 90d

import 'dotenv/config';
const SUPA_URL = process.env.SUPABASE_URL, SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY, AKEY = process.env.ASAAS_PROD_KEY;
if (!SUPA_URL || !SKEY) { console.error('ABORTADO: Supabase ausente.'); process.exit(1); }
if (!AKEY || !AKEY.startsWith('$aact_prod')) { console.error('ABORTADO: ASAAS_PROD_KEY ausente/não-prod.'); process.exit(1); }

const DESDE = process.env.DESDE || new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
const REFUND_STATUSES = ['REFUNDED', 'REFUND_IN_PROGRESS'];
const CHUNK = 5;

const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const sg = async (t, p) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); if (!r.ok) throw new Error(`${t} ${r.status} ${await r.text()}`); return r.json(); };
const agCharge = async (id) => { try { const r = await fetch('https://api.asaas.com/v3/payments/' + id, { headers: { access_token: AKEY } }); return r.ok ? await r.json() : { _http: r.status }; } catch (e) { return { _err: String(e) }; } };
// Lista paginada do Asaas (GET /payments com querystring crua).
const agList = async (qs) => { const out = []; let off = 0; for (;;) { const r = await fetch(`https://api.asaas.com/v3/payments?${qs}&limit=100&offset=${off}`, { headers: { access_token: AKEY } }); if (!r.ok) { console.warn(`  (Asaas list ${qs} → HTTP ${r.status})`); break; } const j = await r.json(); out.push(...(j.data || [])); if (!j.hasMore) break; off += 100; } return out; };
const reais = (cent) => 'R$' + ((cent || 0) / 100).toFixed(2);
const reaisA = (v) => 'R$' + ((v || 0)).toFixed(2);
const dt = (s) => (s ? new Date(s).toISOString().slice(0, 16).replace('T', ' ') : '—');
const day = (s) => (s ? new Date(s).toISOString().slice(0, 10) : '');
const tipo = (p) => (p?.subscriptionId ? 'assinatura' : p?.appointmentId ? 'agendamento' : 'avulso');

async function main() {
  console.log('===== AUDITORIA ESTORNOS (read-only) — ' + new Date().toISOString().slice(0, 16) + ' =====');
  console.log(`Recorte: desde ${DESDE}\n`);

  // Pagamentos locais do período (Asaas + maquininha).
  const pays = await sg('payments', {
    select: 'id,asaasPaymentId,amount,method,billingType,asaasStatus,paidAt,createdAt,appointmentId,subscriptionId,clientId,client:clients(name,phone)',
    createdAt: `gte.${DESDE}`,
    order: 'createdAt.desc',
    limit: '10000',
  });
  const asaasLinked = pays.filter((p) => p.asaasPaymentId);
  const localById = new Map(asaasLinked.map((p) => [p.asaasPaymentId, p]));
  const nSub = asaasLinked.filter((p) => p.subscriptionId).length;
  console.log(`Pagamentos locais no recorte: ${pays.length} (com cobrança Asaas: ${asaasLinked.length} [assinatura: ${nSub}] · maquininha/balcão: ${pays.length - asaasLinked.length})`);

  // ---- PASS 0: Asaas direto — pagamentos estornados na conta ----
  let refundedAll = [];
  for (const st of REFUND_STATUSES) refundedAll.push(...(await agList(`status=${st}&dateCreated[ge]=${DESDE}`)));
  console.log(`\n===== PASS 0 — ESTORNOS NO ASAAS (conta, desde ${DESDE}) (${refundedAll.length}) =====`);
  if (!refundedAll.length) console.log('  (nenhum) → o Asaas NÃO estornou nada no período.');
  for (const c of refundedAll) {
    const loc = localById.get(c.id);
    const refunds = Array.isArray(c.refunds) ? c.refunds.filter((r) => r.status !== 'CANCELLED') : [];
    const rdate = refunds[0]?.effectiveDate || refunds[0]?.dateCreated || null;
    console.log(`  ${loc?.client?.name || c.customer || '(?)'} · ${reaisA(c.value)} · ${c.billingType} · ${loc ? tipo(loc) : '?'} · status=${c.status} · estorno=${dt(rdate)} · charge=${c.id}${loc ? '' : ' [não está no banco local]'}`);
  }

  // ---- PASS A: drift — cobranças locais cujo charge real está deleted/refunded ----
  const drift = [];
  for (let i = 0; i < asaasLinked.length; i += CHUNK) {
    const lote = asaasLinked.slice(i, i + CHUNK);
    const charges = await Promise.all(lote.map((p) => agCharge(p.asaasPaymentId)));
    lote.forEach((p, k) => {
      const c = charges[k] || {};
      const refunds = Array.isArray(c.refunds) ? c.refunds.filter((r) => r.status !== 'CANCELLED') : [];
      if (c.deleted === true || REFUND_STATUSES.includes(c.status) || refunds.length) {
        drift.push({ p, real: c.status, deleted: c.deleted === true, refund: refunds.reduce((s, r) => s + (r.value || 0), 0) });
      }
    });
  }
  console.log(`\n===== PASS A — COBRANÇA LOCAL EXCLUÍDA/ESTORNADA NO ASAAS (${drift.length}) =====`);
  if (!drift.length) console.log('  (nenhuma)');
  for (const d of drift) {
    console.log(`  ${d.p.client?.name || '(?)'} · ${reais(d.p.amount)} · ${d.p.billingType || d.p.method} · ${tipo(d.p)} · Asaas REAL=${d.real}${d.deleted ? ' DELETED' : ''}${d.refund ? ` refund R$${d.refund.toFixed(2)}` : ''} · local=${d.p.asaasStatus} · charge=${d.p.asaasPaymentId}`);
  }

  // ---- PASS B: duplo pagamento (Asaas + maquininha) por agendamento E por cliente+dia ----
  const flagDuplo = (chave, keyOf) => {
    const map = new Map();
    for (const p of pays) { const k = keyOf(p); if (k == null) continue; if (!map.has(k)) map.set(k, []); map.get(k).push(p); }
    const out = [];
    for (const [k, lista] of map) {
      const a = lista.filter((p) => p.asaasPaymentId), m = lista.filter((p) => !p.asaasPaymentId);
      if (a.length && m.length) out.push({ k, a, m, cliente: lista[0].client?.name || '(?)' });
    }
    console.log(`\n===== PASS B — DUPLO PAGAMENTO por ${chave} (${out.length}) =====`);
    if (!out.length) console.log('  (nenhum)');
    for (const d of out) {
      console.log(`  ${d.cliente} · ${chave}=${d.k}`);
      for (const x of d.a) console.log(`     [Asaas]      ${reais(x.amount)} ${x.billingType || x.method} pago=${dt(x.paidAt)} local=${x.asaasStatus} charge=${x.asaasPaymentId}`);
      for (const x of d.m) console.log(`     [maquininha] ${reais(x.amount)} ${x.method || x.billingType} pago=${dt(x.paidAt)} criado=${dt(x.createdAt)}`);
    }
    return out.length;
  };
  const dupAppt = flagDuplo('agendamento', (p) => p.appointmentId);
  const dupCliDia = flagDuplo('cliente+dia', (p) => (p.clientId ? `${p.clientId}|${day(p.paidAt || p.createdAt)}` : null));

  console.log('\n===== RESUMO =====');
  console.log(`  Pagamentos locais: ${pays.length} (Asaas ${asaasLinked.length} / maquininha ${pays.length - asaasLinked.length})`);
  console.log(`  PASS 0 estornos no Asaas: ${refundedAll.length}`);
  console.log(`  PASS A cobrança local excluída/estornada no Asaas: ${drift.length}`);
  console.log(`  PASS B duplo pagamento: agendamento=${dupAppt} · cliente+dia=${dupCliDia}`);
  if (!refundedAll.length && !drift.length) console.log('\n  >>> Nenhum estorno pelo Asaas/app. O estorno relatado é da MAQUININHA (adquirente), fora do sistema.');
}

main().catch((e) => { console.error('FALHA:', e); process.exit(1); });
