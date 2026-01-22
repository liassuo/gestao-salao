import { useQuery } from '@tanstack/react-query';
import { cashRegisterService } from '@/services';
import type { CashRegisterFilters } from '@/types';
import { CASH_REGISTER_QUERY_KEY } from './useCashRegisterToday';

export function useCashRegisters(filters?: CashRegisterFilters) {
  return useQuery({
    queryKey: [CASH_REGISTER_QUERY_KEY, 'list', filters],
    queryFn: () => cashRegisterService.list(filters),
  });
}
