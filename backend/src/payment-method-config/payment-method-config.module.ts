import { Module } from '@nestjs/common';
import { PaymentMethodConfigService } from './payment-method-config.service';
import { PaymentMethodConfigController } from './payment-method-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * PaymentMethodConfig module
 * Manages payment method configurations (e.g., Dinheiro, PIX, Cartao)
 * Handles type (A_VISTA/A_PRAZO) and scope (COMANDA/EXPENSE/BOTH)
 */
@Module({
  imports: [PrismaModule],
  controllers: [PaymentMethodConfigController],
  providers: [PaymentMethodConfigService],
  exports: [PaymentMethodConfigService],
})
export class PaymentMethodConfigModule {}
