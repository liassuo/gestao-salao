import { api } from './api';
import type {
  FinancialTransaction,
  FinancialTransactionFilters,
  CreateFinancialTransactionPayload,
  UpdateFinancialTransactionPayload,
  PayableTotals,
  ReceivableTotals,
  BalanceSummary,
} from '@/types';

export const financialTransactionsService = {
  async list(filters?: FinancialTransactionFilters): Promise<FinancialTransaction[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.branchId) params.append('branchId', filters.branchId);

    const response = await api.get<FinancialTransaction[]>('/financial-transactions', { params });
    return response.data;
  },

  async getPayableTotals(filters?: Pick<FinancialTransactionFilters, 'startDate' | 'endDate' | 'branchId'>): Promise<PayableTotals> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.branchId) params.append('branchId', filters.branchId);

    const response = await api.get<PayableTotals>('/financial-transactions/payable', { params });
    return response.data;
  },

  async getReceivableTotals(filters?: Pick<FinancialTransactionFilters, 'startDate' | 'endDate' | 'branchId'>): Promise<ReceivableTotals> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.branchId) params.append('branchId', filters.branchId);

    const response = await api.get<ReceivableTotals>('/financial-transactions/receivable', { params });
    return response.data;
  },

  async getBalance(filters?: Pick<FinancialTransactionFilters, 'startDate' | 'endDate' | 'branchId'>): Promise<BalanceSummary> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.branchId) params.append('branchId', filters.branchId);

    const response = await api.get<BalanceSummary>('/financial-transactions/balance', { params });
    return response.data;
  },

  async getById(id: string): Promise<FinancialTransaction> {
    const response = await api.get<FinancialTransaction>(`/financial-transactions/${id}`);
    return response.data;
  },

  async create(payload: CreateFinancialTransactionPayload): Promise<FinancialTransaction> {
    const response = await api.post<FinancialTransaction>('/financial-transactions', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateFinancialTransactionPayload): Promise<FinancialTransaction> {
    const response = await api.patch<FinancialTransaction>(`/financial-transactions/${id}`, payload);
    return response.data;
  },

  async markAsPaid(id: string): Promise<FinancialTransaction> {
    const response = await api.patch<FinancialTransaction>(`/financial-transactions/${id}/pay`);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/financial-transactions/${id}`);
  },
};
