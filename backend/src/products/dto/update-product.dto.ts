export class UpdateProductDto {
  name?: string;
  description?: string;
  costPrice?: number;
  salePrice?: number;
  minStock?: number;
  isActive?: boolean;
  branchId?: string;
}
