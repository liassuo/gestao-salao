export interface Product {
  id: string;
  name: string;
  description?: string | null;
  costPrice: number;
  salePrice: number;
  minStock: number;
  isActive?: boolean;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductStock {
  id: string;
  name: string;
  costPrice: number;
  salePrice: number;
  minStock: number;
  currentStock: number;
  stockValue: number;
  potentialSaleValue: number;
  isLowStock: boolean;
  branch?: { id: string; name: string } | null;
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: number;
  reason?: string | null;
  createdBy?: string | null;
  createdAt: string;
  product: { id: string; name: string };
  branch?: { id: string; name: string } | null;
}

export type StockMovementType = 'ENTRY' | 'EXIT';

export interface CreateProductPayload {
  name: string;
  description?: string;
  costPrice: number;
  salePrice: number;
  minStock?: number;
  branchId?: string;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  costPrice?: number;
  salePrice?: number;
  minStock?: number;
  isActive?: boolean;
  branchId?: string;
}

export interface CreateStockMovementPayload {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  branchId?: string;
}

export interface ProductFilters {
  branchId?: string;
  all?: string;
  search?: string;
  isActive?: string;
}

export interface StockMovementFilters {
  productId?: string;
  type?: StockMovementType;
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Saída',
};

export const stockMovementTypeColors: Record<StockMovementType, string> = {
  ENTRY: 'bg-green-500/20 text-green-400',
  EXIT: 'bg-red-500/20 text-red-400',
};
