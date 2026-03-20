/**
 * Script para importar clientes a partir do CSV exportado do Podium/sistema anterior.
 *
 * Uso:
 *   cd backend
 *   npx ts-node scripts/importar-clientes.ts
 *
 * O script:
 *  - Lê o arquivo CSV (backend/scripts/clientes.csv)
 *  - Converte os campos para o formato do banco
 *  - Faz upsert por email (evita duplicatas)
 *  - Insere em lotes de 50
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// --- Config ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://psnuzyzaegfmdsbinpla.supabase.co';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzbnV6eXphZWdmbWRzYmlucGxhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY1NzE5OCwiZXhwIjoyMDg2MjMzMTk4fQ.HZ9rCWqGjJIIOLaRLQXSdn7eaVlevDrTsRXHLW2P6t4';

const BATCH_SIZE = 50;
const CSV_PATH = path.join(__dirname, 'clientes.csv');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Helpers ---

/** Converte "DD/MM/YYYY" para "YYYY-MM-DD" ou retorna null */
function parseDate(value: string): string | null {
  if (!value || value === 'N/A') return null;
  const parts = value.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  // Sanity: ano entre 1900 e 2100
  if (y < 1900 || y > 2100) return null;
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Converte "DD/MM/YYYY" para ISO timestamp */
function parseDateToTimestamp(value: string): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return `${date}T00:00:00.000Z`;
}

/** Retorna null se valor é vazio ou "N/A" */
function clean(value: string): string | null {
  if (!value || value.trim() === '' || value.trim() === 'N/A') return null;
  return value.trim();
}

/** Parse de uma linha CSV (lida com campos entre aspas) */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

interface ClientRow {
  name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  addressNumber: string | null;
  state: string | null;
  city: string | null;
  birthDate: string | null;
  createdAt: string;
  lastVisitAt: string | null;
}

function parseRow(fields: string[]): ClientRow | null {
  // Colunas: Nome,CPF,Email,Telefone,Logradouro,Bairro,Número,UF,Cidade,Data de nascimento,Data de cadastro,Data útima visita
  if (fields.length < 12) return null;

  const name = clean(fields[0]);
  if (!name) return null;

  const email = clean(fields[2]);
  const phone = clean(fields[3]);

  // Precisamos de pelo menos email ou telefone
  if (!email && !phone) return null;

  const createdAtRaw = clean(fields[10]);
  const createdAt = parseDateToTimestamp(createdAtRaw || '') || new Date().toISOString();

  return {
    name,
    cpf: clean(fields[1]),
    email,
    phone,
    address: clean(fields[4]),
    neighborhood: clean(fields[5]),
    addressNumber: clean(fields[6]),
    state: clean(fields[7]),
    city: clean(fields[8]),
    birthDate: parseDate(fields[9] || ''),
    createdAt,
    lastVisitAt: parseDateToTimestamp(fields[11] || ''),
  };
}

async function main() {
  console.log('=== Importação de Clientes ===\n');

  // 1. Ler CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Arquivo não encontrado: ${CSV_PATH}`);
    console.error('Coloque o arquivo clientes.csv em backend/scripts/');
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  // Pular cabeçalho
  const header = lines[0];
  console.log(`Cabeçalho: ${header}`);
  console.log(`Total de linhas (sem cabeçalho): ${lines.length - 1}\n`);

  // 2. Buscar emails já existentes para evitar duplicatas
  const { data: existingClients } = await supabase
    .from('clients')
    .select('email, phone');

  const existingEmails = new Set(
    (existingClients || []).filter((c) => c.email).map((c) => c.email!.toLowerCase()),
  );
  const existingPhones = new Set(
    (existingClients || []).filter((c) => c.phone).map((c) => c.phone),
  );

  console.log(`Clientes existentes no banco: ${existingClients?.length || 0}`);

  // 3. Parse das linhas
  const clients: ClientRow[] = [];
  const skipped: string[] = [];
  const duplicates: string[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row = parseRow(fields);

    if (!row) {
      skipped.push(`Linha ${i + 1}: dados insuficientes`);
      continue;
    }

    // Verificar duplicata por email
    const emailKey = row.email?.toLowerCase();
    if (emailKey) {
      if (existingEmails.has(emailKey) || seenEmails.has(emailKey)) {
        duplicates.push(`${row.name} (${row.email}) - email já existe`);
        continue;
      }
      seenEmails.add(emailKey);
    } else if (row.phone && existingPhones.has(row.phone)) {
      // Se não tem email, checar por telefone
      duplicates.push(`${row.name} (${row.phone}) - telefone já existe`);
      continue;
    }

    clients.push(row);
  }

  console.log(`\nClientes para importar: ${clients.length}`);
  console.log(`Duplicatas ignoradas: ${duplicates.length}`);
  console.log(`Linhas inválidas: ${skipped.length}`);

  if (duplicates.length > 0 && duplicates.length <= 20) {
    console.log('\nDuplicatas:');
    duplicates.forEach((d) => console.log(`  - ${d}`));
  }

  if (clients.length === 0) {
    console.log('\nNenhum cliente novo para importar.');
    return;
  }

  // 4. Inserir em lotes
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const batch = clients.slice(i, i + BATCH_SIZE);
    const now = new Date().toISOString();

    const records = batch.map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      email: c.email,
      phone: c.phone || '',
      cpf: c.cpf,
      birthDate: c.birthDate,
      address: c.address,
      addressNumber: c.addressNumber,
      neighborhood: c.neighborhood,
      city: c.city,
      state: c.state,
      lastVisitAt: c.lastVisitAt,
      hasDebts: false,
      isActive: true,
      createdAt: c.createdAt,
      updatedAt: now,
    }));

    const { data, error } = await supabase.from('clients').insert(records).select('id');

    if (error) {
      console.error(`\nErro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      // Tentar inserir um por um para identificar o registro problemático
      for (const record of records) {
        const { error: singleError } = await supabase.from('clients').insert(record);
        if (singleError) {
          console.error(`  Falha: ${record.name} (${record.email}) - ${singleError.message}`);
          errors++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += data?.length || batch.length;
    }

    process.stdout.write(`\rProgresso: ${Math.min(i + BATCH_SIZE, clients.length)}/${clients.length}`);
  }

  console.log(`\n\n=== Resultado ===`);
  console.log(`Importados com sucesso: ${inserted}`);
  console.log(`Erros: ${errors}`);
  console.log(`Duplicatas ignoradas: ${duplicates.length}`);
}

main().catch(console.error);
