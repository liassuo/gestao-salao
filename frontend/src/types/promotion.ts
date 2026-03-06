export type PromotionStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DISABLED';

export interface PromotionService {
  id: string;
  name: string;
  price: number;
  duration?: number;
}

export interface PromotionProduct {
  id: string;
  name: string;
  salePrice: number;
}

export interface Promotion {
  id: string;
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  bannerImageUrl: string | null;
  bannerTitle: string | null;
  bannerText: string | null;
  isTemplate: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  services: PromotionService[];
  products: PromotionProduct[];
}

export interface CreatePromotionPayload {
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  bannerImageUrl?: string;
  bannerTitle?: string;
  bannerText?: string;
  isTemplate?: boolean;
  serviceIds?: string[];
  productIds?: string[];
}

export type UpdatePromotionPayload = Partial<CreatePromotionPayload> & { isActive?: boolean };
