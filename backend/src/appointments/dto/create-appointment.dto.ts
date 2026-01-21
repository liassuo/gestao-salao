import {
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ArrayMinSize,
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
}
