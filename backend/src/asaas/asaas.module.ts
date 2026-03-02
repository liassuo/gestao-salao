import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { AsaasService } from './asaas.service';
import { AsaasController } from './asaas.controller';
import { AsaasWebhookController } from './asaas-webhook.controller';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [AsaasController, AsaasWebhookController],
  providers: [AsaasService],
  exports: [AsaasService],
})
export class AsaasModule {}
