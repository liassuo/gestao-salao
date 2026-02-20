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

  // Alias for backward compatibility with Prisma-style naming
  get user() { return this.from('users'); }
  get client_() { return this.from('clients'); }
  get professional() { return this.from('professionals'); }
  get service() { return this.from('services'); }
  get appointment() { return this.from('appointments'); }
  get appointmentService() { return this.from('appointment_services'); }
  get payment() { return this.from('payments'); }
  get debt() { return this.from('debts'); }
  get cashRegister() { return this.from('cash_registers'); }
  get subscriptionPlan() { return this.from('subscription_plans'); }
  get clientSubscription() { return this.from('client_subscriptions'); }
  get bankAccount() { return this.from('bank_accounts'); }
  get branch() { return this.from('branches'); }
  get commission() { return this.from('commissions'); }
  get paymentMethodConfig() { return this.from('payment_method_configs'); }
  get financialTransaction() { return this.from('financial_transactions'); }
  get financialCategory() { return this.from('financial_categories'); }
  get product() { return this.from('products'); }
  get stockMovement() { return this.from('stock_movements'); }
  get order() { return this.from('orders'); }
  get orderItem() { return this.from('order_items'); }
  get timeBlock() { return this.from('time_blocks'); }
}
