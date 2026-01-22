import { useMutation, useQueryClient } from '@tanstack/react-query';
import { debtsService } from '@/services';
import type { CreateDebtPayload } from '@/types';

export function useCreateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDebtPayload) => debtsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
