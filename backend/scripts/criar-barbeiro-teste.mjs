// Cria (ou recria) um BARBEIRO DE TESTE para validar a restrição de acesso (PR #33).
// professional + user role=PROFESSIONAL vinculados, senha conhecida, mustChangePassword=false.
// Idempotente: se já existir o email, remove antes e recria limpo.
//   node scripts/criar-barbeiro-teste.mjs          # cria
//   node scripts/criar-barbeiro-teste.mjs --remove # remove o de teste
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

const REMOVE = process.argv.includes('--remove');
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/';
const sh = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };

const EMAIL = 'barbeiro.teste@teste.com';
const SENHA = 'teste123';
const NOME = 'Barbeiro Teste (QA)';

const sget = async (t, q) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); const r = await fetch(u, { headers: sh }); return r.json(); };
const sdel = async (t, q) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); const r = await fetch(u, { method: 'DELETE', headers: { ...sh, Prefer: 'return=minimal' } }); if (!r.ok) console.warn(`del ${t}: ${r.status}`); };
const sins = async (t, row) => { const r = await fetch(SB + t, { method: 'POST', headers: { ...sh, Prefer: 'return=representation' }, body: JSON.stringify(row) }); if (!r.ok) throw new Error(`insert ${t} ${r.status} ${(await r.text()).slice(0, 200)}`); return r.json(); };
const supd = async (t, q, patch) => { const u = new URL(SB + t); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); const r = await fetch(u, { method: 'PATCH', headers: { ...sh, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) console.warn(`upd ${t}: ${r.status}`); };

async function cleanup() {
  const users = await sget('users', { select: 'id,professionalId', email: 'eq.' + EMAIL });
  for (const u of users) {
    if (u.professionalId) await sdel('professionals', { id: 'eq.' + u.professionalId });
    await sdel('users', { id: 'eq.' + u.id });
  }
  // por segurança, remove professional órfão com o nome de teste
  const profs = await sget('professionals', { select: 'id', name: 'eq.' + NOME });
  for (const p of profs) await sdel('professionals', { id: 'eq.' + p.id });
}

async function main() {
  await cleanup();
  if (REMOVE) { console.log('Barbeiro de teste removido.'); return; }

  const now = new Date().toISOString();
  const profId = randomUUID();
  await sins('professionals', {
    id: profId, name: NOME, commissionRate: 50, workingHours: [], isActive: true, createdAt: now, updatedAt: now,
  });
  const userId = randomUUID();
  const hash = await bcrypt.hash(SENHA, 6);
  await sins('users', {
    id: userId, email: EMAIL, name: NOME, password: hash, role: 'PROFESSIONAL',
    professionalId: profId, isActive: true, mustChangePassword: false, createdAt: now, updatedAt: now,
  });
  await supd('professionals', { id: 'eq.' + profId }, { userId });

  console.log('=== BARBEIRO DE TESTE CRIADO ===');
  console.log('  email:', EMAIL);
  console.log('  senha:', SENHA);
  console.log('  professionalId:', profId);
  console.log('  userId:', userId);
}
main().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
