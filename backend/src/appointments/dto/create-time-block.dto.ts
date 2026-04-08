import { IsString, IsOptional, IsDateString } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

export class CreateTimeBlockDto {
  @IsString()
  professionalId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;

  /** Valida que endTime > startTime */
  static validate(dto: CreateTimeBlockDto) {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('O horário de fim deve ser posterior ao horário de início');
    }
  }
}
