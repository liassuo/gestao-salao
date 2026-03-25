import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import * as path from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PaymentsModule } from './payments/payments.module';
import { DebtsModule } from './debts/debts.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { BranchesModule } from './branches/branches.module';
import { CommissionsModule } from './commissions/commissions.module';
import { PaymentMethodConfigModule } from './payment-method-config/payment-method-config.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { OrdersModule } from './orders/orders.module';
import { AsaasModule } from './asaas/asaas.module';
import { PromotionsModule } from './promotions/promotions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '..', '.env'),
      ],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProfessionalsModule,
    ServicesModule,
    AppointmentsModule,
    PaymentsModule,
    DebtsModule,
    CashRegisterModule,
    DashboardModule,
    ReportsModule,
    SubscriptionsModule,
    BranchesModule,
    CommissionsModule,
    PaymentMethodConfigModule,
    ProductsModule,
    StockModule,
    OrdersModule,
    AsaasModule,
    PromotionsModule,
    NotificationsModule,
    SettingsModule,
    MailModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

