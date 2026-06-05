import { IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '../../common/enums';

export class ConfirmPaymentDto {
  // Como o cliente pagou a mensalidade no balcão. Default CASH (dinheiro),
  // que é o caso mais comum de confirmação manual.
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Método deve ser CASH, PIX ou CARD' })
  method?: PaymentMethod;
}
