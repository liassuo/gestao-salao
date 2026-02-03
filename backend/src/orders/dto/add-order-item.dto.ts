export class AddOrderItemDto {
  productId?: string;
  serviceId?: string;
  quantity?: number;
  unitPrice: number;
  itemType: 'PRODUCT' | 'SERVICE';
}
