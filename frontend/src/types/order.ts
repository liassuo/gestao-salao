export interface Order {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  notes?: string | null;
  appointmentId?: string | null;
  consumerType?: OrderConsumerType;
  consumerProfessionalId?: string | null;
  consumerProfessional?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string } | null;
  professional?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  items: OrderItem[];
}

export type OrderConsumerType = 'CLIENT' | 'PROFESSIONAL';

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  itemType: OrderItemType;
  product?: { id: string; name: string } | null;
  service?: { id: string; name: string } | null;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'PAID_AS_DEBT' | 'CANCELED';
export type OrderItemType = 'PRODUCT' | 'SERVICE';

export interface CreateOrderPayload {
  clientId?: string;
  professionalId?: string;
  branchId?: string;
  notes?: string;
  consumerType?: OrderConsumerType;
  consumerProfessionalId?: string;
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
  PAID_AS_DEBT: 'Lançado como débito',
  CANCELED: 'Cancelado',
};

export const orderStatusColors: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  PAID: 'bg-green-500/20 text-green-400',
  PAID_AS_DEBT: 'bg-purple-500/20 text-purple-400',
  CANCELED: 'bg-red-500/20 text-red-400',
};
