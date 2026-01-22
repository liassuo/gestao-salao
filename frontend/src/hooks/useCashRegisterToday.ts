import { useQuery } from '@tanstack/react-query';
import { cashRegisterService } from '@/services';

export const CASH_REGISTER_QUERY_KEY = 'cash-register';

export function useCashRegisterToday() {
  return useQuery({
    queryKey: [CASH_REGISTER_QUERY_KEY, 'today'],
    queryFn: () => cashRegisterService.getToday(),
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}

export function useCashRegisterOpen() {
  return useQuery({
    queryKey: [CASH_REGISTER_QUERY_KEY, 'open'],
    queryFn: () => cashRegisterService.getOpen(),
    refetchInterval: 30000,
  });
}
