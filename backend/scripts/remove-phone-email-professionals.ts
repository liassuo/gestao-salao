import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  // Supabase client SDK não permite ALTER TABLE,
  // mas podemos usar a rpc ou SQL Editor.
  // Vamos usar fetch direto na REST API do Supabase para rodar SQL.

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({}),
  });

  console.log('Para remover as colunas phone e email da tabela professionals,');
  console.log('execute o seguinte SQL no SQL Editor do Supabase:');
  console.log('');
  console.log('ALTER TABLE professionals DROP COLUMN IF EXISTS phone;');
  console.log('ALTER TABLE professionals DROP COLUMN IF EXISTS email;');
}

run();
