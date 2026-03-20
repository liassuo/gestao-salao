import { api } from './api';
import type {
  Product, ProductStock, CreateProductPayload,
  UpdateProductPayload, ProductFilters,
} from '@/types';

export const productsService = {
  async list(filters?: ProductFilters): Promise<Product[]> {
    const params = new URLSearchParams();
    if (filters?.branchId) params.append('branchId', filters.branchId);
    if (filters?.all) params.append('all', filters.all);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive);
    const response = await api.get<Product[]>('/products', { params });
    return response.data;
  },

  async getById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  async getStock(branchId?: string): Promise<ProductStock[]> {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    const response = await api.get<ProductStock[]>('/products/stock', { params });
    return response.data;
  },

  async getLowStock(branchId?: string): Promise<ProductStock[]> {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    const response = await api.get<ProductStock[]>('/products/low-stock', { params });
    return response.data;
  },

  async create(payload: CreateProductPayload): Promise<Product> {
    const response = await api.post<Product>('/products', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateProductPayload): Promise<Product> {
    const response = await api.patch<Product>(`/products/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async permanentDelete(id: string): Promise<void> {
    await api.delete(`/products/${id}/permanent`);
  },
};
