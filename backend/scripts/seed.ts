import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

const supabaseUrl = process.env.SUPABASE_URL || 'https://wumujknegjwihftgjcms.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Admin user
  const hashedPassword = await bcrypt.hash('123456', 10);

  const { data: admin, error: adminError } = await supabase
    .from('users')
    .upsert(
      {
        email: 'admin@barbearia.com',
        name: 'Admin',
        password: hashedPassword,
        role: 'ADMIN',
        is_active: true,
      },
      { onConflict: 'email' },
    )
    .select('id, email')
    .single();

  if (adminError) {
    console.error('Erro ao criar admin:', adminError.message);
  } else {
    console.log('Admin criado:', admin.email);
  }

  // 2. Services
  const servicesData = [
    { name: 'Corte de Cabelo', description: 'Corte masculino tradicional', price: 4500, duration: 30, is_active: true },
    { name: 'Barba', description: 'Aparar e modelar barba', price: 3000, duration: 20, is_active: true },
    { name: 'Corte + Barba', description: 'Combo corte e barba', price: 6500, duration: 45, is_active: true },
  ];

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .upsert(servicesData, { onConflict: 'name' })
    .select('id, name');

  if (servicesError) {
    console.error('Erro ao criar servicos:', servicesError.message);
  } else {
    console.log('Servicos criados:', services?.length);
  }

  // 3. Professional
  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .upsert(
      {
        name: 'Joao Barbeiro',
        phone: '11999999999',
        email: 'joao@barbearia.com',
        commission_rate: 50.0,
        working_hours: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 6, startTime: '09:00', endTime: '14:00' },
        ],
        is_active: true,
      },
      { onConflict: 'email' },
    )
    .select('id, name');

  if (profError) {
    console.error('Erro ao criar profissional:', profError.message);
  } else {
    console.log('Profissional criado:', professional?.[0]?.name);
  }

  // 4. Client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .upsert(
      {
        name: 'Carlos Cliente',
        email: 'carlos@email.com',
        phone: '11988888888',
        is_active: true,
      },
      { onConflict: 'email' },
    )
    .select('id, name');

  if (clientError) {
    console.error('Erro ao criar cliente:', clientError.message);
  } else {
    console.log('Cliente criado:', client?.[0]?.name);
  }

  console.log('\n--- Seed concluido! ---');
  console.log('Login admin: admin@barbearia.com / 123456');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
