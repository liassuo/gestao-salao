// Corrige o webhook do Asaas em produção (causa do "pagou no PIX e não renovou"):
//  1. Cadastra o authToken do webhook = ASAAS_WEBHOOK_TOKEN (hoje está VAZIO no
//     Asaas, então TODA notificação de pagamento é rejeitada com 403 pelo backend).
//  2. Garante o webhook habilitado e a fila não-interrompida.
//  3. Assina os eventos que o backend trata mas não estavam marcados:
//     PAYMENT_REFUND_IN_PROGRESS e PAYMENT_DELETED.
//
// Não imprime segredos. Lê ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN do backend/.env.
//
// Uso (a partir de backend/):
//   node scripts/fix-webhook-token.mjs           # DRY-RUN: mostra o estado atual e o que faria
//   node scripts/fix-webhook-token.mjs --apply   # aplica a mudança no Asaas
//
// Depois de aplicar, valide com:
//   node scripts/fix-webhook-token.mjs --test    # POST vazio no endpoint com/sem token (espera 403/200)

import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const TEST = process.argv.includes('--test');

const AKEY = process.env.ASAAS_API_KEY;
const WHTOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
if (!AKEY || !AKEY.startsWith('$aact_prod')) {
  console.error('ABORTADO: ASAAS_API_KEY ausente ou não é de produção ($aact_prod...).');
  process.exit(1);
}
if (!WHTOKEN || WHTOKEN === 'your-webhook-secret-token') {
  console.error('ABORTADO: ASAAS_WEBHOOK_TOKEN ausente/placeholder no .env.');
  process.exit(1);
}

const WEBHOOK_URL = 'https://gestao-salao-backend-jiss.onrender.com/api/webhooks/asaas';
const WANTED_EVENTS = ['PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_DELETED'];

async function probe(withToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (withToken) headers['asaas-access-token'] = WHTOKEN;
  const r = await fetch(WEBHOOK_URL, { method: 'POST', headers, body: '{}' });
  return r.status;
}

async function main() {
  if (TEST) {
    // POST vazio (sem "event"/"payment") é inofensivo: o handler só valida o token
    // e responde {received:true} sem tocar em nada.
    const sem = await probe(false);
    const com = await probe(true);
    console.log(`POST sem token  -> ${sem}  (esperado: 403 = validação ativa)`);
    console.log(`POST com token  -> ${com}  (esperado: 200/201 = token do .env bate com a produção)`);
    if (sem === 403 && com >= 200 && com < 300) {
      console.log('\nOK: o backend aceita o token. Se o Asaas já estiver com o authToken cadastrado, os webhooks voltam a fluir.');
    } else if (com === 403) {
      console.log('\nATENÇÃO: o token do .env local NÃO bate com o da produção (Render). Confira ASAAS_WEBHOOK_TOKEN no Render.');
    }
    return;
  }

  const list = await (await fetch('https://api.asaas.com/v3/webhooks', { headers: { access_token: AKEY } })).json();
  const wh = (list.data || []).find((w) => w.url === WEBHOOK_URL) || (list.data || [])[0];
  if (!wh) {
    console.error('Nenhum webhook cadastrado no Asaas. Crie um pelo painel apontando para: ' + WEBHOOK_URL);
    process.exit(1);
  }

  console.log('===== Webhook atual no Asaas =====');
  console.log('  id         :', wh.id);
  console.log('  url        :', wh.url);
  console.log('  enabled    :', wh.enabled, '| interrupted:', wh.interrupted, '| sendType:', wh.sendType);
  console.log('  authToken  :', wh.authToken ? '(configurado)' : '(VAZIO — backend rejeita tudo com 403)');
  console.log('  events     :', (wh.events || []).join(', '));

  const events = [...new Set([...(wh.events || []), ...WANTED_EVENTS])];
  const alreadyOk = !!wh.authToken && wh.enabled && !wh.interrupted && WANTED_EVENTS.every((e) => (wh.events || []).includes(e));

  if (!APPLY) {
    console.log('\n===== O que o --apply faria =====');
    console.log('  authToken  : cadastrar o valor de ASAAS_WEBHOOK_TOKEN do .env');
    console.log('  enabled    : true | interrupted: false');
    console.log('  events     :', events.join(', '));
    console.log(alreadyOk ? '\n(Já parece OK — aplicar seria no-op.)' : '\n(DRY-RUN: nada foi alterado. Rode com --apply para aplicar.)');
    return;
  }

  const r = await fetch('https://api.asaas.com/v3/webhooks/' + wh.id, {
    method: 'PUT',
    headers: { access_token: AKEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ authToken: WHTOKEN, events, enabled: true, interrupted: false }),
  });
  const j = await r.json();
  if (!r.ok) {
    console.error('FALHA no PUT:', r.status, JSON.stringify(j).slice(0, 400));
    process.exit(1);
  }
  console.log('\n===== Webhook atualizado =====');
  console.log('  enabled    :', j.enabled, '| interrupted:', j.interrupted);
  console.log('  authToken  :', j.authToken ? '(configurado ✅)' : '(ainda vazio ❌)');
  console.log('  events     :', (j.events || []).join(', '));
  console.log('\nPronto. Valide com: node scripts/fix-webhook-token.mjs --test');
}

main().catch((e) => { console.error('FALHA GERAL:', e.message); process.exit(1); });
