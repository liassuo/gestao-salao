import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AsaasModule } from '../asaas/asaas.module';

/**
 * Subscriptions module
 * Manages subscription plans and client subscriptions
 * Handles plan catalog, client subscription management, and cut tracking
 */
@Module({
  imports: [PrismaModule, AsaasModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
