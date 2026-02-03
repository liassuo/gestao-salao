export interface Order {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string } | null;
  professional?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  itemType: OrderItemType;
  product?: { id: string; name: string } | null;
  service?: { id: string; name: string } | null;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELED';
export type OrderItemType = 'PRODUCT' | 'SERVICE';

export interface CreateOrderPayload {
  clientId?: string;
  professionalId?: string;
  branchId?: string;
  notes?: string;
  items?: CreateOrderItemPayload[];
}

export interface CreateOrderItemPayload {
  productId?: string;
  serviceId?: string;
  quantity?: number;
  unitPrice: number;
  itemType: OrderItemType;
}

export interface AddOrderItemPayload {
  productId?: string;
  serviceId?: string;
  quantity?: number;
  unitPrice: number;
  itemType: OrderItemType;
}

export interface OrderFilters {
  status?: OrderStatus;
  branchId?: string;
  startDate?: string;
  endDate?: string;
  clientId?: string;
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELED: 'Cancelado',
};

export const orderStatusColors: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  PAID: 'bg-green-500/20 text-green-400',
  CANCELED: 'bg-red-500/20 text-red-400',
};
