/**
 * DTO for subscribing a client to a plan
 */
export class SubscribeClientDto {
  clientId: string;
  planId: string;
  startDate?: string;
}
