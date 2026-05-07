import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  from(table: string) {
    return this.supabase.from(table);
  }

  /**
   * Chama uma stored procedure (RPC) do Postgres. Usado para operações que
   * precisam ser atômicas no banco — ex.: incremento/decremento de contadores
   * sem read-modify-write (debit_subscription_cuts, refund_subscription_cuts).
   */
  rpc<TArgs extends Record<string, unknown> = Record<string, unknown>>(
    fn: string,
    args?: TArgs,
  ) {
    return this.supabase.rpc(fn, args ?? {});
  }
}
