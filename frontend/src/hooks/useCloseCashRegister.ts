import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterService } from '@/services';
import type { CloseCashRegisterPayload } from '@/types';
import { CASH_REGISTER_QUERY_KEY } from './useCashRegisterToday';

export function useCloseCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CloseCashRegisterPayload }) =>
      cashRegisterService.close(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CASH_REGISTER_QUERY_KEY] });
    },
  });
}
