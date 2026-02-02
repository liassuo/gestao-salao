import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentMethodConfigService } from '@/services';
import type { PaymentMethodConfigFilters, CreatePaymentMethodConfigPayload, UpdatePaymentMethodConfigPayload } from '@/types';

const PAYMENT_METHOD_CONFIG_KEY = ['payment-method-config'];

export function usePaymentMethodConfigs(filters?: PaymentMethodConfigFilters) {
  return useQuery({
    queryKey: [...PAYMENT_METHOD_CONFIG_KEY, filters],
    queryFn: () => paymentMethodConfigService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePaymentMethodConfig(id: string) {
  return useQuery({
    queryKey: [...PAYMENT_METHOD_CONFIG_KEY, id],
    queryFn: () => paymentMethodConfigService.getById(id),
    enabled: !!id,
  });
}

export function useCreatePaymentMethodConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePaymentMethodConfigPayload) => paymentMethodConfigService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHOD_CONFIG_KEY });
    },
  });
}

export function useUpdatePaymentMethodConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePaymentMethodConfigPayload }) =>
      paymentMethodConfigService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHOD_CONFIG_KEY });
    },
  });
}

export function useDeletePaymentMethodConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentMethodConfigService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHOD_CONFIG_KEY });
    },
  });
}
