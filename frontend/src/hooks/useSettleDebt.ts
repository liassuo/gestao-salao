import { useMutation, useQueryClient } from '@tanstack/react-query';
import { debtsService } from '@/services';

export function useSettleDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => debtsService.settle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
