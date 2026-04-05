import { IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '../../common/enums';

export class MarkAsAttendedDto {
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Método deve ser CASH, PIX ou CARD' })
  paymentMethod?: PaymentMethod;
}
