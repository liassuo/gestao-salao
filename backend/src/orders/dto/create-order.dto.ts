export class CreateOrderDto {
  clientId?: string;
  professionalId?: string;
  branchId?: string;
  notes?: string;
  items?: CreateOrderItemDto[];
}

export class CreateOrderItemDto {
  productId?: string;
  serviceId?: string;
  quantity?: number;
  unitPrice: number; // centavos
  itemType: 'PRODUCT' | 'SERVICE';
}
