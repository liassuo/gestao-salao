import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
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
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { BranchesModule } from './branches/branches.module';
import { CommissionsModule } from './commissions/commissions.module';
import { PaymentMethodConfigModule } from './payment-method-config/payment-method-config.module';
import { FinancialTransactionsModule } from './financial-transactions/financial-transactions.module';
import { FinancialCategoriesModule } from './financial-categories/financial-categories.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
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
    BankAccountsModule,
    BranchesModule,
    CommissionsModule,
    PaymentMethodConfigModule,
    FinancialTransactionsModule,
    FinancialCategoriesModule,
    ProductsModule,
    StockModule,
    OrdersModule,
  ],
})
export class AppModule {}
