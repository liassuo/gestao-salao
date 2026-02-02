import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankAccountsService } from '@/services';
import type { CreateBankAccountPayload, UpdateBankAccountPayload } from '@/types';

const BANK_ACCOUNTS_KEY = ['bank-accounts'];

export function useBankAccounts() {
  return useQuery({
    queryKey: BANK_ACCOUNTS_KEY,
    queryFn: () => bankAccountsService.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveBankAccounts() {
  return useQuery({
    queryKey: [...BANK_ACCOUNTS_KEY, 'active'],
    queryFn: () => bankAccountsService.listActive(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBankAccount(id: string) {
  return useQuery({
    queryKey: [...BANK_ACCOUNTS_KEY, id],
    queryFn: () => bankAccountsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBankAccountPayload) => bankAccountsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_KEY });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBankAccountPayload }) =>
      bankAccountsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_KEY });
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bankAccountsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_KEY });
    },
  });
}
