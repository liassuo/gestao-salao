import { api } from './api';
import type { BankAccount, CreateBankAccountPayload, UpdateBankAccountPayload } from '@/types';

export const bankAccountsService = {
  async list(): Promise<BankAccount[]> {
    const response = await api.get<BankAccount[]>('/bank-accounts');
    return response.data;
  },

  async listActive(): Promise<BankAccount[]> {
    const response = await api.get<BankAccount[]>('/bank-accounts/active');
    return response.data;
  },

  async getById(id: string): Promise<BankAccount> {
    const response = await api.get<BankAccount>(`/bank-accounts/${id}`);
    return response.data;
  },

  async create(payload: CreateBankAccountPayload): Promise<BankAccount> {
    const response = await api.post<BankAccount>('/bank-accounts', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateBankAccountPayload): Promise<BankAccount> {
    const response = await api.patch<BankAccount>(`/bank-accounts/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/bank-accounts/${id}`);
  },
};
