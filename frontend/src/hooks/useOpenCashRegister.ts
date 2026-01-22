import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterService } from '@/services';
import type { OpenCashRegisterPayload } from '@/types';
import { CASH_REGISTER_QUERY_KEY } from './useCashRegisterToday';

export function useOpenCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OpenCashRegisterPayload) => cashRegisterService.open(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CASH_REGISTER_QUERY_KEY] });
    },
  });
}
