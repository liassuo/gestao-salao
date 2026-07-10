import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { AsaasService } from './asaas.service';
import { AsaasController } from './asaas.controller';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { CashRegisterModule } from '../cash-register/cash-register.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConfigModule, SupabaseModule, CashRegisterModule, NotificationsModule],
  controllers: [AsaasController, AsaasWebhookController],
  providers: [AsaasService],
  exports: [AsaasService],
})
export class AsaasModule {}
