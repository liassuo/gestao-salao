/**
 * Script: desativa notificações Asaas para todos os clientes já criados.
 *
 * Usa GET /customers paginado e PUT /customers/{id} com notificationDisabled=true.
 *
 * Executar (sandbox primeiro!):
 *   ASAAS_ENVIRONMENT=sandbox npx ts-node -r tsconfig-paths/register scripts/disable-asaas-notifications.ts
 *
 * Em produção:
 *   ASAAS_ENVIRONMENT=production npx ts-node -r tsconfig-paths/register scripts/disable-asaas-notifications.ts
 *
 * Flags:
 *   DRY_RUN=true  -> apenas lista, não faz PUT
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.ASAAS_API_KEY;
const env = (process.env.ASAAS_ENVIRONMENT || 'sandbox').toLowerCase();
const dryRun = process.env.DRY_RUN === 'true';

if (!apiKey) {
  console.error('ASAAS_API_KEY ausente no .env / ambiente.');
  process.exit(1);
}

const baseURL =
  env === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

const http = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json', access_token: apiKey },
  timeout: 30000,
});

interface AsaasCustomerLite {
  id: string;
  name: string;
  notificationDisabled?: boolean;
}

interface AsaasListResponse {
  data: AsaasCustomerLite[];
  hasMore: boolean;
  totalCount?: number;
  limit: number;
  offset: number;
}

async function run() {
  console.log(`Asaas baseURL: ${baseURL}`);
  console.log(`Dry run: ${dryRun}\n`);

  const limit = 100;
  let offset = 0;
  let totalSeen = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  while (true) {
    const { data } = await http.get<AsaasListResponse>('/customers', {
      params: { limit, offset },
    });
    const customers = data.data || [];
    totalSeen += customers.length;

    for (const c of customers) {
      if (c.notificationDisabled) {
        totalSkipped++;
        continue;
      }
      if (dryRun) {
        console.log(`DRY ${c.id} ${c.name}`);
        continue;
      }
      try {
        await http.put(`/customers/${c.id}`, { notificationDisabled: true });
        totalUpdated++;
        console.log(`OK  ${c.id} ${c.name}`);
      } catch (err: any) {
        totalErrors++;
        const detail = err.response?.data || err.message;
        console.error(`ERR ${c.id} ${c.name}:`, detail);
      }
      // throttle leve para evitar rate-limit
      await new Promise((r) => setTimeout(r, 150));
    }

    if (!data.hasMore) break;
    offset += limit;
  }

  console.log(
    `\nSeen=${totalSeen} Updated=${totalUpdated} Skipped(already disabled)=${totalSkipped} Errors=${totalErrors}`,
  );
}

run().catch((e) => {
  console.error('Falha geral:', e);
  process.exit(1);
});
