import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialTransactionsService } from '@/services';
import type {
  FinancialTransactionFilters,
  CreateFinancialTransactionPayload,
  UpdateFinancialTransactionPayload,
} from '@/types';

const FINANCIAL_TRANSACTIONS_KEY = ['financial-transactions'];

export function useFinancialTransactions(filters?: FinancialTransactionFilters) {
  return useQuery({
    queryKey: [...FINANCIAL_TRANSACTIONS_KEY, filters],
    queryFn: () => financialTransactionsService.list(filters),
  });
}

export function useFinancialTransaction(id: string) {
  return useQuery({
    queryKey: [...FINANCIAL_TRANSACTIONS_KEY, id],
    queryFn: () => financialTransactionsService.getById(id),
    enabled: !!id,
  });
}

export function usePayableTotals(filters?: Pick<FinancialTransactionFilters, 'startDate' | 'endDate' | 'branchId'>) {
  return useQuery({
    queryKey: [...FINANCIAL_TRANSACTIONS_KEY, 'payable', filters],
    queryFn: () => financialTransactionsService.getPayableTotals(filters),
  });
}

export function useReceivableTotals(filters?: Pick<FinancialTransactionFilters, 'startDate' | 'endDate' | 'branchId'>) {
  return useQuery({
    queryKey: [...FINANCIAL_TRANSACTIONS_KEY, 'receivable', filters],
    queryFn: () => financialTransactionsService.getReceivableTotals(filters),
  });
}

export function useBalanceSummary(filters?: Pick<FinancialTransactionFilters, 'startDate' | 'endDate' | 'branchId'>) {
  return useQuery({
    queryKey: [...FINANCIAL_TRANSACTIONS_KEY, 'balance', filters],
    queryFn: () => financialTransactionsService.getBalance(filters),
  });
}

export function useCreateFinancialTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFinancialTransactionPayload) => financialTransactionsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_TRANSACTIONS_KEY });
    },
  });
}

export function useUpdateFinancialTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFinancialTransactionPayload }) =>
      financialTransactionsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_TRANSACTIONS_KEY });
    },
  });
}

export function useMarkTransactionAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financialTransactionsService.markAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_TRANSACTIONS_KEY });
    },
  });
}

export function useDeleteFinancialTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financialTransactionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_TRANSACTIONS_KEY });
    },
  });
}
