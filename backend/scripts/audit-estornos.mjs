// AUDITORIA read-only (NÃO escreve nada). Investiga a queixa "o app estornou e o
// barbeiro recobrou na maquininha". Roda com a chave de prod.
//
// POR QUE a auditoria por status LOCAL não achava nada:
//   Quando o app EXCLUI a cobrança (cancel/no-show/atender → DELETE /payments), o
//   Asaas dispara PAYMENT_DELETED — evento DESMARCADO no painel — então o handler
//   handlePaymentDeleted nunca roda e o `payments.asaasStatus` LOCAL fica velho
//   (PENDING/CONFIRMED). Filtrar asaasStatus=REFUNDED local não vê esses casos.
//   => Aqui consultamos o Asaas DIRETO (getCharge) e o padrão de duplo-pagamento.
//
// 2 passes:
//  PASS A — ASAAS DIRETO: para cada pagamento Asaas de agendamento CANCELED/NO_SHOW/
//           ATTENDED no período, consulta o charge REAL no Asaas e sinaliza se está
//           `deleted`, REFUNDED/REFUND_IN_PROGRESS, ou tem refunds[]. É a digital da
//           cobrança que o app excluiu/estornou (independe do status local).
//  PASS B — DUPLO PAGAMENTO (só banco, não depende de Asaas/webhook): agendamento com
//           cobrança Asaas E um pagamento de maquininha/balcão (sem asaasPaymentId).
//           Casa exatamente com "estornou no app, recobrou na maquininha".
//
// Uso (a partir de backend/):
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/audit-estornos.mjs
//   # opcional: recorte por data de criação do pagamento (default: últimos 90 dias)
//   DESDE=2026-01-01 ASAAS_PROD_KEY='$aact_prod_...' node scripts/audit-estornos.mjs

import 'dotenv/config';
const SUPA_URL = process.env.SUPABASE_URL, SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY, AKEY = process.env.ASAAS_PROD_KEY;
if (!SUPA_URL || !SKEY) { console.error('ABORTADO: Supabase ausente.'); process.exit(1); }
if (!AKEY || !AKEY.startsWith('$aact_prod')) { console.error('ABORTADO: ASAAS_PROD_KEY ausente/não-prod.'); process.exit(1); }

const DESDE = process.env.DESDE || new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
const ACAO_STATUSES = ['CANCELED', 'NO_SHOW', 'ATTENDED'];
const REFUND_STATUSES = ['REFUNDED', 'REFUND_IN_PROGRESS'];
const CHUNK = 5; // lotes de getCharge p/ não estourar rate-limit do Asaas

const SB = SUPA_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const sg = async (t, p) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); if (!r.ok) throw new Error(`${t} ${r.status} ${await r.text()}`); return r.json(); };
const agCharge = async (id) => { try { const r = await fetch('https://api.asaas.com/v3/payments/' + id, { headers: { access_token: AKEY } }); return r.ok ? await r.json() : { _http: r.status }; } catch (e) { return { _err: String(e) }; } };
const reais = (cent) => 'R$' + ((cent || 0) / 100).toFixed(2);
const dt = (s) => (s ? new Date(s).toISOString().slice(0, 16).replace('T', ' ') : '—');

async function main() {
  console.log('===== AUDITORIA ESTORNOS (read-only) — ' + new Date().toISOString().slice(0, 16) + ' =====');
  console.log(`Recorte: pagamentos criados desde ${DESDE}\n`);

  // Todos os pagamentos do período ligados a um agendamento (Asaas e maquininha).
  const pays = await sg('payments', {
    select: 'id,asaasPaymentId,amount,method,billingType,asaasStatus,paidAt,createdAt,appointmentId,clientId,client:clients(name,phone),appointment:appointments!appointmentId(id,status,canceledAt,attendedAt,updatedAt)',
    appointmentId: 'not.is.null',
    createdAt: `gte.${DESDE}`,
    order: 'createdAt.desc',
    limit: '5000',
  });
  console.log(`Pagamentos no recorte: ${pays.length}`);

  // ---- PASS A: consulta o Asaas direto p/ as cobranças de agendamentos "ação" ----
  const suspeitos = pays.filter(
    (p) => p.asaasPaymentId && p.appointment && ACAO_STATUSES.includes(p.appointment.status),
  );
  console.log(`Cobranças Asaas em agendamento CANCELED/NO_SHOW/ATTENDED a consultar no Asaas: ${suspeitos.length}\n`);

  const achados = [];
  for (let i = 0; i < suspeitos.length; i += CHUNK) {
    const lote = suspeitos.slice(i, i + CHUNK);
    const charges = await Promise.all(lote.map((p) => agCharge(p.asaasPaymentId)));
    lote.forEach((p, k) => {
      const c = charges[k] || {};
      const refunds = Array.isArray(c.refunds) ? c.refunds.filter((r) => r.status !== 'CANCELLED') : [];
      const estornadoNoAsaas =
        c.deleted === true || REFUND_STATUSES.includes(c.status) || refunds.length > 0;
      if (estornadoNoAsaas) {
        const appt = p.appointment;
        achados.push({
          cliente: p.client?.name || '(sem nome)',
          valor: reais(p.amount),
          billing: p.billingType || p.method || '?',
          apptStatus: appt.status,
          acao: dt(appt.canceledAt || appt.attendedAt || appt.updatedAt),
          asaasStatusReal: c.status || (c._http ? `HTTP ${c._http}` : c._err || '?'),
          deleted: c.deleted === true,
          refundReais: refunds.reduce((s, r) => s + (r.value || 0), 0),
          asaasPaymentId: p.asaasPaymentId,
          localStatus: p.asaasStatus,
        });
      }
    });
  }

  console.log(`\n===== PASS A — COBRANÇAS ESTORNADAS/EXCLUÍDAS NO ASAAS (${achados.length}) =====`);
  if (!achados.length) console.log('  (nenhuma)');
  for (const a of achados) {
    console.log(
      `  ${a.cliente} · ${a.valor} · ${a.billing} · agendamento=${a.apptStatus} (ação ${a.acao})\n` +
      `     Asaas REAL: status=${a.asaasStatusReal}${a.deleted ? ' · DELETED' : ''}${a.refundReais ? ` · refund R$${a.refundReais.toFixed(2)}` : ''} | local=${a.localStatus}\n` +
      `     charge=${a.asaasPaymentId}`,
    );
  }

  // ---- PASS B: duplo pagamento (Asaas + maquininha) no mesmo agendamento ----
  const porAppt = new Map();
  for (const p of pays) {
    if (!porAppt.has(p.appointmentId)) porAppt.set(p.appointmentId, []);
    porAppt.get(p.appointmentId).push(p);
  }
  const duplos = [];
  for (const [apptId, lista] of porAppt) {
    const asaas = lista.filter((p) => p.asaasPaymentId);
    const maquininha = lista.filter((p) => !p.asaasPaymentId); // sem cobrança Asaas = balcão/maquininha
    if (asaas.length && maquininha.length) {
      duplos.push({ apptId, asaas, maquininha, appt: lista[0].appointment, cliente: lista[0].client?.name || '(sem nome)' });
    }
  }

  console.log(`\n===== PASS B — DUPLO PAGAMENTO: Asaas + maquininha no mesmo agendamento (${duplos.length}) =====`);
  if (!duplos.length) console.log('  (nenhum)');
  for (const d of duplos) {
    console.log(`  ${d.cliente} · agendamento=${d.appt?.status || '?'} (${d.apptId})`);
    for (const a of d.asaas) console.log(`     [Asaas]      ${reais(a.amount)} ${a.billingType || a.method} pago=${dt(a.paidAt)} local=${a.asaasStatus} charge=${a.asaasPaymentId}`);
    for (const m of d.maquininha) console.log(`     [maquininha] ${reais(m.amount)} ${m.method || m.billingType} pago=${dt(m.paidAt)} criado=${dt(m.createdAt)}`);
  }

  console.log('\n===== RESUMO =====');
  console.log(`  Pagamentos analisados: ${pays.length}`);
  console.log(`  PASS A (estornadas/excluídas no Asaas): ${achados.length}`);
  console.log(`  PASS B (duplo pagamento Asaas+maquininha): ${duplos.length}`);
  console.log('\n  PASS A = cobrança que o app excluiu/estornou (Asaas direto, ignora status local desatualizado).');
  console.log('  PASS B = digital de "estornou no app e recobrou na maquininha" (só banco). Cruze A x B pelo cliente.');
}

main().catch((e) => { console.error('FALHA:', e); process.exit(1); });
