import { IsString, IsOptional } from 'class-validator';

export class SubscribeClientDto {
  @IsString()
  clientId: string;

  @IsString()
  planId: string;

  @IsOptional()
  @IsString()
  startDate?: string;
}
