import { IsString, IsOptional, Matches } from 'class-validator';

/**
 * Datas vêm como string "YYYY-MM-DD" para preservar o dia exato escolhido
 * pelo admin. Não usamos Date para não cair em conversão automática de fuso.
 */
export class CreateVacationDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate deve estar no formato YYYY-MM-DD',
  })
  startDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate deve estar no formato YYYY-MM-DD',
  })
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateVacationDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate deve estar no formato YYYY-MM-DD',
  })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate deve estar no formato YYYY-MM-DD',
  })
  endDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
