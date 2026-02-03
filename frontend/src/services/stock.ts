import { api } from './api';
import type {
  StockMovement, CreateStockMovementPayload, StockMovementFilters,
} from '@/types';

export const stockService = {
  async listMovements(filters?: StockMovementFilters): Promise<StockMovement[]> {
    const params = new URLSearchParams();
    if (filters?.productId) params.append('productId', filters.productId);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.branchId) params.append('branchId', filters.branchId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const response = await api.get<StockMovement[]>('/stock/movements', { params });
    return response.data;
  },

  async createMovement(payload: CreateStockMovementPayload): Promise<StockMovement> {
    const response = await api.post<StockMovement>('/stock/movements', payload);
    return response.data;
  },
};
