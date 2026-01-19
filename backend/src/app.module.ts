import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PaymentsModule } from './payments/payments.module';
import { DebtsModule } from './debts/debts.module';
import { CashRegisterModule } from './cash-register/cash-register.module';

/**
 * Root application module
 * Organizes the system by domain-driven modules
 */
@Module({
  imports: [
    PrismaModule, // Global module for database access
    UsersModule,
    ClientsModule,
    ProfessionalsModule,
    ServicesModule,
    AppointmentsModule,
    PaymentsModule,
    DebtsModule,
    CashRegisterModule,
  ],
})
export class AppModule {}
