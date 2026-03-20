import { useMutation, useQueryClient } from '@tanstack/react-query';
import { debtsService } from '@/services';

export function useSettleDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, method }: { id: string; method?: string }) => debtsService.settle(id, method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
