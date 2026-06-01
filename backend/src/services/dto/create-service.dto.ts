import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fichas?: number;

  // Ordem em que o servico aparece nas listas (menor primeiro). Default 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  displayOrder?: number;
}
