import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsService } from '@/services';
import type { CreatePaymentPayload } from '@/types';

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) => paymentsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}
