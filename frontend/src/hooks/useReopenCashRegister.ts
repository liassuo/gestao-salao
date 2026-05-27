import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterService } from '@/services';
import { CASH_REGISTER_QUERY_KEY } from './useCashRegisterToday';

export function useReopenCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cashRegisterService.reopen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CASH_REGISTER_QUERY_KEY] });
    },
  });
}
