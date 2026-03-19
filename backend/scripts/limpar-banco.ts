import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Tabelas na ordem correta (mais dependentes primeiro)
const tabelas = [
  // Nivel 4 - juncoes e itens
  'order_items',
  'appointment_services',
  'promotion_services',
  'promotion_products',
  '_ProfessionalToService',
  'professional_services',

  // Nivel 3
  'commissions',
  'stock_movements',
  'payments',
  'debts',
  'push_subscriptions',

  // Nivel 2
  'orders',
  'appointments',
  'client_subscriptions',
  'time_blocks',
  'products',

  // Nivel 1
  'cash_registers',
  'promotions',
  'professionals',
  'services',

  // Nivel 0 - tabelas base
  'clients',
  'branches',
  'subscription_plans',
  'bank_accounts',
  'payment_method_configs',
  'settings',
];

async function limpar() {
  console.log('Limpando banco de dados...\n');

  for (const tabela of tabelas) {
    // .delete() precisa de um filtro, usamos neq com id impossivel
    // ou gt com data antiga para pegar tudo
    const { error, count } = await supabase
      .from(tabela)
      .delete({ count: 'exact' })
      .gte('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      // Tenta com filtro alternativo (tabelas sem campo id UUID)
      const { error: err2 } = await supabase
        .from(tabela)
        .delete()
        .not('id', 'is', null);

      if (err2) {
        console.log(`  ❌ ${tabela}: ${err2.message}`);
      } else {
        console.log(`  ✅ ${tabela}: limpa`);
      }
    } else {
      console.log(`  ✅ ${tabela}: limpa (${count ?? '?'} registros removidos)`);
    }
  }

  // Limpar usuarios exceto admin
  const { error, count } = await supabase
    .from('users')
    .delete({ count: 'exact' })
    .neq('email', 'admin@barbearia.com');

  if (error) {
    console.log(`  ❌ users: ${error.message}`);
  } else {
    console.log(`  ✅ users: limpa (${count ?? '?'} removidos, admin@barbearia.com mantido)`);
  }

  console.log('\nPronto! Banco limpo.');
}

limpar().catch(console.error);
