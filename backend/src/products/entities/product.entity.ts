export class Product {
  id: string;
  name: string;
  description?: string;
  costPrice: number;
  salePrice: number;
  minStock: number;
  isActive: boolean;
  branchId?: string;
  createdAt: Date;
  updatedAt: Date;
}
