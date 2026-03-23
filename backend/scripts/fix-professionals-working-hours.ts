/**
 * Script: define horários de trabalho padrão para profissionais sem workingHours
 * Padrão: Seg-Sex 09:00-18:00 | Sab 09:00-14:00 | Dom folga
 *
 * Executar: npx ts-node -r tsconfig-paths/register scripts/fix-professionals-working-hours.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const DEFAULT_WORKING_HOURS = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }, // Seg
  { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' }, // Ter
  { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' }, // Qua
  { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' }, // Qui
  { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' }, // Sex
  { dayOfWeek: 6, startTime: '09:00', endTime: '14:00' }, // Sab
];

async function fix() {
  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, name, workingHours');

  if (error) { console.error('Erro:', error.message); return; }

  const toFix = (professionals || []).filter(
    (p: any) => !p.workingHours || !Array.isArray(p.workingHours) || p.workingHours.length === 0,
  );

  if (toFix.length === 0) {
    console.log('Todos os profissionais já têm workingHours configurados.');
    return;
  }

  console.log(`Corrigindo ${toFix.length} profissional(is):\n`);

  for (const prof of toFix) {
    console.log(`→ ${prof.name} (${prof.id})`);
    const { error: err } = await supabase
      .from('professionals')
      .update({ workingHours: DEFAULT_WORKING_HOURS, updatedAt: new Date().toISOString() })
      .eq('id', prof.id);

    console.log(err ? `  ❌ ${err.message}` : '  ✅ workingHours definidos (Seg-Sex 09-18, Sab 09-14)');
  }

  console.log('\nConcluído!');
}

fix().catch(console.error);
