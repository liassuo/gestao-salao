import { Module } from '@nestjs/common';
import { PaymentMethodConfigService } from './payment-method-config.service';
import { PaymentMethodConfigController } from './payment-method-config.controller';
/**
 * PaymentMethodConfig module
 * Manages payment method configurations (e.g., Dinheiro, PIX, Cartao)
 * Handles type (A_VISTA/A_PRAZO) and scope (COMANDA/EXPENSE/BOTH)
 */
@Module({
  controllers: [PaymentMethodConfigController],
  providers: [PaymentMethodConfigService],
  exports: [PaymentMethodConfigService],
})
export class PaymentMethodConfigModule {}
