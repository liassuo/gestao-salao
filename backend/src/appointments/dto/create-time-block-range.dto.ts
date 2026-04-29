import {
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';

/**
 * Cria N bloqueios em um intervalo de datas. Para cada dia entre startDate e endDate
 * (inclusivo), gera um time_block com a faixa de horário informada (ou dia inteiro).
 *
 * Útil para bloquear férias / folgas prolongadas ("dia 23 ao dia 27").
 */
export class CreateTimeBlockRangeDto {
  @IsString()
  professionalId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate deve estar no formato YYYY-MM-DD' })
  startDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate deve estar no formato YYYY-MM-DD' })
  endDate: string;

  /** HH:MM. Obrigatório quando allDay=false. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime deve estar no formato HH:MM' })
  startTime?: string;

  /** HH:MM. Obrigatório quando allDay=false. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime deve estar no formato HH:MM' })
  endTime?: string;

  /** Quando true, bloqueia o dia inteiro (00:00 a 23:59) e ignora startTime/endTime. */
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  static validate(dto: CreateTimeBlockRangeDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate deve ser maior ou igual a startDate');
    }
    if (!dto.allDay) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'startTime e endTime são obrigatórios quando allDay=false',
        );
      }
      if (dto.endTime <= dto.startTime) {
        throw new BadRequestException(
          'O horário de fim deve ser posterior ao horário de início',
        );
      }
    }
  }
}
