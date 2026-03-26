import {
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ArrayMinSize,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  professionalId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'Pelo menos um serviço deve ser selecionado' })
  serviceIds: string[];

  @IsDateString()
  scheduledAt: Date;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['PIX', 'CREDIT_CARD', 'CASH'])
  billingType?: 'PIX' | 'CREDIT_CARD' | 'CASH';

  @IsOptional()
  @IsBoolean()
  useSubscriptionCut?: boolean;

  @IsOptional()
  @IsIn(['ADMIN', 'CLIENT'])
  source?: 'ADMIN' | 'CLIENT';
}
