export class CreateStockMovementDto {
  productId: string;
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  reason?: string;
  branchId?: string;
}
