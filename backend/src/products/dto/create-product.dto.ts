export class CreateProductDto {
  name: string;
  description?: string;
  costPrice: number; // centavos
  salePrice: number; // centavos
  minStock?: number;
  branchId?: string;
}
