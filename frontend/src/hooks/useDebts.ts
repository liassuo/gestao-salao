import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debtsService } from '@/services';
import type { DebtFilters } from '@/types';

const QUERY_KEY = 'debts';

export function useDebts(filters?: DebtFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => debtsService.list(filters),
  });
}

export function useOutstandingDebts() {
  return useQuery({
    queryKey: [QUERY_KEY, 'outstanding'],
    queryFn: () => debtsService.getOutstanding(),
  });
}

export function useClientDebtTotal(clientId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'client-total', clientId],
    queryFn: () => debtsService.getClientTotal(clientId!),
    enabled: !!clientId,
  });
}

export function useDebtActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
  };

  const deleteMutation = useMutation({
    mutationFn: debtsService.delete,
    onSuccess: invalidate,
  });

  return {
    remove: deleteMutation.mutateAsync,
    isLoading: deleteMutation.isPending,
  };
}
