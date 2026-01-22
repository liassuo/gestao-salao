import { useMutation, useQueryClient } from '@tanstack/react-query';
import { debtsService } from '@/services';
import type { PartialPaymentPayload } from '@/types';

export function usePayDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PartialPaymentPayload }) =>
      debtsService.partialPayment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
