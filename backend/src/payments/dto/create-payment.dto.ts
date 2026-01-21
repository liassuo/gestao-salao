import {
  IsUUID,
  IsEnum,
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsInt({ message: 'Valor deve ser um número inteiro (centavos)' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;

  @IsEnum(PaymentMethod, { message: 'Método deve ser CASH, PIX ou CARD' })
  method: PaymentMethod;

  @IsUUID()
  registeredBy: string;

  @IsOptional()
  @IsDateString()
  paidAt?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}
