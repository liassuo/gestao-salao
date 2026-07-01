// Configura o barbeiro de teste com horário de trabalho + 1 serviço, pra ele ter
// slots disponíveis na agenda e dar pra testar "marcar horário". Read-mostly + 2 updates.
import 'dotenv/config';
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
const sget = async (t, q) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); return r.json(); };
const supd = async (t, q, patch) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); const r = await fetch(u, { method: 'PATCH', headers: { ...sh, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) console.warn(`upd ${t}: ${r.status} ${(await r.text()).slice(0,150)}`); };
const sins = async (t, row) => { const r = await fetch(SB + t, { method: 'POST', headers: { ...sh, Prefer: 'return=minimal' }, body: JSON.stringify(row) }); if (!r.ok) console.warn(`ins ${t}: ${r.status} ${(await r.text()).slice(0,150)}`); };

(async () => {
  const prof = (await sget('professionals', { select: 'id,name', name: 'eq.Barbeiro Teste (QA)' }))[0];
  if (!prof) { console.error('barbeiro de teste não achado — rode criar-barbeiro-teste.mjs antes'); process.exit(1); }

  // horário de trabalho seg-sáb 09:00-18:00 (formato que o sistema usa)
  const dias = [1, 2, 3, 4, 5, 6]; // 0=dom
  const workingHours = dias.map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00', isActive: true }));
  await supd('professionals', { id: 'eq.' + prof.id }, { workingHours });
  console.log('workingHours setado (seg-sáb 09-18).');

  // vincular 1 serviço existente
  const svc = (await sget('services', { select: 'id,name,duration,price', isActive: 'eq.true', limit: '1' }))[0];
  if (svc) {
    // tabela de vínculo professional_services (nome comum). Se falhar, mostra pra ajustar.
    await sins('professional_services', { professionalId: prof.id, serviceId: svc.id });
    console.log(`serviço vinculado: ${svc.name} (${svc.duration}min, R$${(svc.price/100).toFixed(2)})`);
  } else {
    console.log('nenhum serviço ativo encontrado.');
  }
  console.log('OK — professionalId:', prof.id);
})().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
