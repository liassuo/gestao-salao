/**
 * Script de migração: corrige professionals com userId nulo
 *
 * Para cada profissional sem userId, busca o user vinculado
 * (via professionalId na tabela users) e atualiza o campo.
 *
 * Executar: npx ts-node -r tsconfig-paths/register scripts/fix-professionals-userid-email.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fix() {
  console.log('Buscando profissionais com userId nulo...\n');

  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, name, userId')
    .is('userId', null);

  if (error) {
    console.error('Erro ao buscar profissionais:', error.message);
    return;
  }

  if (!professionals || professionals.length === 0) {
    console.log('Nenhum profissional com userId nulo. Tudo OK!');
    return;
  }

  console.log(`Encontrados ${professionals.length} profissional(is) para corrigir:\n`);

  for (const prof of professionals) {
    console.log(`→ ${prof.name} (id: ${prof.id})`);

    // Buscar o user vinculado a este profissional
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('professionalId', prof.id)
      .single();

    if (userError || !user) {
      console.log(`  ⚠️  Nenhum user vinculado encontrado — pulando.\n`);
      continue;
    }

    console.log(`  User vinculado: ${user.email} (id: ${user.id})`);

    const { error: updateError } = await supabase
      .from('professionals')
      .update({ userId: user.id, updatedAt: new Date().toISOString() })
      .eq('id', prof.id);

    if (updateError) {
      console.log(`  ❌ Erro ao atualizar: ${updateError.message}\n`);
    } else {
      console.log(`  ✅ userId atualizado com sucesso!\n`);
    }
  }

  console.log('Migração concluída!');
}

fix().catch(console.error);
