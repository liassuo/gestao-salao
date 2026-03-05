import { api } from './api';
import type { Promotion, CreatePromotionPayload, UpdatePromotionPayload } from '@/types';

export const promotionsService = {
  async list(filters?: { status?: string; isTemplate?: boolean }): Promise<Promotion[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.isTemplate !== undefined) params.set('isTemplate', String(filters.isTemplate));
    const response = await api.get<Promotion[]>(`/promotions?${params.toString()}`);
    return response.data;
  },

  async getById(id: string): Promise<Promotion> {
    const response = await api.get<Promotion>(`/promotions/${id}`);
    return response.data;
  },

  async getActive(): Promise<Promotion[]> {
    const response = await api.get<Promotion[]>('/promotions/active');
    return response.data;
  },

  async getTemplates(): Promise<Promotion[]> {
    const response = await api.get<Promotion[]>('/promotions/templates');
    return response.data;
  },

  async create(payload: CreatePromotionPayload): Promise<Promotion> {
    const response = await api.post<Promotion>('/promotions', payload);
    return response.data;
  },

  async cloneFromTemplate(templateId: string, overrides: Partial<CreatePromotionPayload>): Promise<Promotion> {
    const response = await api.post<Promotion>(`/promotions/clone/${templateId}`, overrides);
    return response.data;
  },

  async update(id: string, payload: UpdatePromotionPayload): Promise<Promotion> {
    const response = await api.patch<Promotion>(`/promotions/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/promotions/${id}`);
  },

  async uploadBanner(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{ url: string }>('/promotions/upload-banner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
