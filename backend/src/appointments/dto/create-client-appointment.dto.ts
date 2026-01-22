import {
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  IsString,
  ArrayMinSize,
} from 'class-validator';

/**
 * DTO para criação de agendamento pelo app mobile (cliente)
 * Não inclui clientId pois será extraído do token JWT
 */
export class CreateClientAppointmentDto {
  @IsUUID()
  professionalId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'Pelo menos um serviço deve ser selecionado' })
  serviceIds: string[];

  @IsDateString()
  date: string; // Formato: YYYY-MM-DD

  @IsString()
  startTime: string; // Formato: HH:mm

  @IsOptional()
  @IsString()
  notes?: string;
}
