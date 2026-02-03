export class QueryStockMovementDto {
  productId?: string;
  type?: 'ENTRY' | 'EXIT';
  branchId?: string;
  startDate?: string;
  endDate?: string;
}
