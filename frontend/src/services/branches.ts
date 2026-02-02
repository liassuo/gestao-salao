import { api } from './api';
import type { Branch, CreateBranchPayload, UpdateBranchPayload } from '@/types';

export const branchesService = {
  async list(): Promise<Branch[]> {
    const response = await api.get<Branch[]>('/branches');
    return response.data;
  },

  async listActive(): Promise<Branch[]> {
    const response = await api.get<Branch[]>('/branches/active');
    return response.data;
  },

  async getById(id: string): Promise<Branch> {
    const response = await api.get<Branch>(`/branches/${id}`);
    return response.data;
  },

  async create(payload: CreateBranchPayload): Promise<Branch> {
    const response = await api.post<Branch>('/branches', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateBranchPayload): Promise<Branch> {
    const response = await api.patch<Branch>(`/branches/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/branches/${id}`);
  },
};
