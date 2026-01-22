import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsService } from '@/services';
import type { PaymentFilters, UpdatePaymentPayload } from '@/types';

const QUERY_KEY = 'payments';

export function usePayments(filters?: PaymentFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => paymentsService.list(filters),
  });
}

export function usePaymentTotals(filters?: Pick<PaymentFilters, 'startDate' | 'endDate'>) {
  return useQuery({
    queryKey: [QUERY_KEY, 'totals', filters],
    queryFn: () => paymentsService.getTotals(filters),
  });
}

export function usePaymentActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePaymentPayload }) =>
      paymentsService.update(id, payload),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: paymentsService.delete,
    onSuccess: invalidate,
  });

  return {
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isLoading: updateMutation.isPending || deleteMutation.isPending,
  };
}
