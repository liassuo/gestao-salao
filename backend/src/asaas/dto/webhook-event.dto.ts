import { IsString, IsObject, IsOptional, IsEnum } from 'class-validator';
import { AsaasWebhookEvent } from '../asaas.types';

export class WebhookEventDto {
  @IsEnum(AsaasWebhookEvent)
  event: AsaasWebhookEvent;

  @IsOptional()
  @IsObject()
  payment?: Record<string, any>;
}
