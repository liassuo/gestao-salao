export class QueryOrderDto {
  status?: 'PENDING' | 'PAID' | 'CANCELED';
  branchId?: string;
  startDate?: string;
  endDate?: string;
  clientId?: string;
}
