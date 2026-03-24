import {
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  IsDateString,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChargeDto {
  @ApiProperty({ description: 'ID do cliente local (UUID)' })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    description: 'Tipo de cobrança',
    enum: ['PIX', 'CREDIT_CARD'],
    example: 'PIX',
  })
  @IsIn(['PIX', 'CREDIT_CARD'], {
    message: 'billingType deve ser PIX ou CREDIT_CARD',
  })
  billingType: 'PIX' | 'CREDIT_CARD';

  @ApiProperty({
    description: 'Valor em centavos (ex: 5000 = R$ 50,00)',
    example: 5000,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  value: number; // centavos - será convertido para reais na chamada

  @ApiProperty({
    description: 'Data de vencimento (YYYY-MM-DD)',
    example: '2026-03-15',
  })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Descrição da cobrança' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Referência externa (ex: ID do agendamento ou comanda)',
  })
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiPropertyOptional({
    description: 'ID do agendamento vinculado',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({
    description: 'ID da comanda vinculada',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;
}
