import { api } from './api';
import type { FinancialCategory, FinancialCategoryFilters, CreateFinancialCategoryPayload, UpdateFinancialCategoryPayload } from '@/types';

export const financialCategoriesService = {
  async list(filters?: FinancialCategoryFilters): Promise<FinancialCategory[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.parentId) params.append('parentId', filters.parentId);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const response = await api.get<FinancialCategory[]>('/financial-categories', { params });
    return response.data;
  },

  async getById(id: string): Promise<FinancialCategory> {
    const response = await api.get<FinancialCategory>(`/financial-categories/${id}`);
    return response.data;
  },

  async create(payload: CreateFinancialCategoryPayload): Promise<FinancialCategory> {
    const response = await api.post<FinancialCategory>('/financial-categories', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateFinancialCategoryPayload): Promise<FinancialCategory> {
    const response = await api.patch<FinancialCategory>(`/financial-categories/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/financial-categories/${id}`);
  },
};
