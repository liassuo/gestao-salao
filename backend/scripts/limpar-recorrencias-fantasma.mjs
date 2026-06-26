// Limpa as recorrências FANTASMA (UNDEFINED) criadas em junho pelo botão "Cobrar/
// Reconciliar", que geram inadimplência falsa em quem pagou PIX avulso.
//
// ESCOPO (decisão do dono 2026-06-16): cancelar as 11 recorrências de clientes que
// pagaram PIX + a do Douglas (nunca pagou). NÃO mexe nas 4 de CARTÃO (Caio, Odilon,
// Gustavo Ferro, Joel) — serão tratadas à parte (converter, não cancelar).
//
// Para cada recorrência alvo:
//   1) cancela as cobranças PENDING/OVERDUE que ela gerou (DELETE /payments/{id})
//   2) cancela a recorrência (DELETE /subscriptions/{id})
//   3) [banco] anula a dívida falsa 'Cobrança não paga' em aberto do cliente e
//      recalcula hasDebts (só os que TÊM dívida: Douglas, Raphael, Leandro, Aurelio)
//
// NÃO toca em caixa (dívida não é receita) nem nos 4 que pagaram junho (já ACTIVE/limpos).
//
// Uso (a partir de backend/):
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/limpar-recorrencias-fantasma.mjs          # DRY-RUN
//   ASAAS_PROD_KEY='$aact_prod_...' node scripts/limpar-recorrencias-fantasma.mjs --apply

import 'dotenv/config';
const APPLY = process.argv.includes('--apply');
const SUPA = process.env.SUPABASE_URL, SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY, AKEY = process.env.ASAAS_PROD_KEY;
if (!SUPA || !SKEY) { console.error('ABORTADO: Supabase ausente.'); process.exit(1); }
if (!AKEY || !AKEY.startsWith('$aact_prod')) { console.error('ABORTADO: ASAAS_PROD_KEY ausente/não-prod.'); process.exit(1); }
const SB = SUPA.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: SKEY, Authorization: 'Bearer ' + SKEY };
const SETTLED = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

const ag = async (p, method = 'GET') => { const r = await fetch('https://api.asaas.com/v3/' + p, { method, headers: { access_token: AKEY } }); return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }; };
const sg = async (t, p) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); return r.json(); };
const sbpatch = async (t, filt, body) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(filt)) u.searchParams.set(k, v); const r = await fetch(u, { method: 'PATCH', headers: { ...sh, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`patch ${t} ${r.status} ${(await r.text()).slice(0, 150)}`); return r.json(); };

// 11 PIX + Douglas (nunca pagou). [nome, subId, clientId-no-banco-ou-null]
const ALVOS = [
  ['Thiago Alves Santos', 'sub_pe4vfpq8pl22rdus', 'c3135644-b42f-45a4-b843-6394318664b0'],
  ['Carlos Henrique de Oliveira', 'sub_jm9w5z11ozivw0ac', null],
  ['Raphael Bruno', 'sub_zvflok2ds6dvyq16', '28482e7b-9bfd-4c68-ac9b-05dfbc038c35'],
  ['LEANDRO BELO', 'sub_q8apub49h4g7q4w4', '10c44188-d73c-4d6a-9d09-6112f4e19619'],
  ['Lucas lima', 'sub_unkn26oi961o7l1p', '02b2a133-9508-4e76-bcb8-4abb362e37eb'],
  ['Juliano Barbosa', 'sub_smsiysfapcbw9s3s', 'a32c5761-7be6-4999-b3ae-dfdb1e6581a4'],
  ['Otávio Henrique', 'sub_3k7d54qw6dtxulle', '45b32056-0e4d-4661-9abd-990982bb81d9'],
  ['Heitor peres gomes', 'sub_s1rpj5d4cyywsb9f', '037d0bbd-cd3e-4e36-a8bf-1eaca3ce1c50'],
  ['Aurelio de macedo', 'sub_7l72zozb88juvtwc', '5378b30b-3e61-4a3e-adf0-c16f3f27987a'],
  ['fábio alves nunes', 'sub_xfoyw7aw294ijqbm', 'd13e2a53-dc65-43cf-8f52-a5827f5420f5'],
  ['Raul Gil pinheiro', 'sub_qsvcjk6qgk4zalg0', 'df89b76f-6288-4b9a-a82d-42d3bc732a38'],
  ['Douglas Junior', 'sub_gpqvxxbgxoe17lx9', '8f395bdc-f1ea-4faa-8166-9b9f880b243b'],
];

async function main() {
  console.log(`===== LIMPAR RECORRÊNCIAS FANTASMA — ${APPLY ? 'APPLY (ESCREVE)' : 'DRY-RUN'} =====\n`);
  let recCanceladas = 0, cobrCanceladas = 0, dividasAnuladas = 0;

  for (const [nome, subId, clientId] of ALVOS) {
    // sanity: confirma que a recorrência é UNDEFINED (não cancelar cartão por engano)
    const sub = await ag('subscriptions/' + subId);
    if (!sub.ok) { console.log(`  ${nome}: recorrência ${subId} não encontrada (${sub.status}) — pula`); continue; }
    if (sub.j.billingType !== 'UNDEFINED') { console.log(`  ${nome}: recorrência NÃO é UNDEFINED (${sub.j.billingType}) — PULA por segurança`); continue; }

    // cobranças PENDING/OVERDUE geradas pela recorrência
    const ch = (await ag(`subscriptions/${subId}/payments?limit=100`)).j.data || [];
    const aCancelar = ch.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');
    const pagas = ch.filter((c) => SETTLED.includes(c.status));

    console.log(`  ${nome.padEnd(26)} ${subId} | cobranças: ${aCancelar.length} a cancelar (${pagas.length} pagas serão PRESERVADAS)`);

    if (APPLY) {
      for (const c of aCancelar) { const d = await ag('payments/' + c.id, 'DELETE'); if (d.ok) cobrCanceladas++; else console.log(`      ! falha ao cancelar cobrança ${c.id}: ${d.status}`); }
      const dr = await ag('subscriptions/' + subId, 'DELETE');
      if (dr.ok) { recCanceladas++; console.log(`      recorrência cancelada`); } else console.log(`      ! falha ao cancelar recorrência: ${dr.status}`);
    }

    // dívida falsa no banco
    if (clientId) {
      const debts = await sg('debts', { select: 'id,amount,description', clientId: 'eq.' + clientId, isSettled: 'eq.false', description: 'ilike.Cobrança não paga*' });
      if (debts.length) {
        console.log(`      [banco] ${debts.length} dívida(s) 'Cobrança não paga' a ANULAR (recorrência fantasma)`);
        if (APPLY) {
          const now = new Date().toISOString();
          // Anula por CANCELAMENTO (não foi paga): zera saldo, marca settled, paidAt=null,
          // sufixo [anulada: recorrência fantasma] p/ rastro. NÃO vira receita/caixa.
          for (const d of debts) {
            const desc = (d.description || '').includes('[anulada') ? d.description : `${d.description} [anulada: recorrência fantasma]`;
            await sbpatch('debts', { id: 'eq.' + d.id, isSettled: 'eq.false' }, { isSettled: true, amountPaid: 0, remainingBalance: 0, paidAt: null, description: desc, updatedAt: now });
            dividasAnuladas++;
          }
          const rem = await sg('debts', { select: 'id', clientId: 'eq.' + clientId, isSettled: 'eq.false' });
          await sbpatch('clients', { id: 'eq.' + clientId }, { hasDebts: rem.length > 0 });
        }
      }
    }
  }

  console.log(`\n${APPLY ? 'Recorrências canceladas: ' + recCanceladas + ' | cobranças fantasma canceladas: ' + cobrCanceladas + ' | dívidas anuladas: ' + dividasAnuladas : '(DRY-RUN: nada escrito.)'}`);
  console.log('Não tocadas: 4 recorrências de CARTÃO (Caio, Odilon, Gustavo Ferro, Joel) — tratamento à parte.');
}
main().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
