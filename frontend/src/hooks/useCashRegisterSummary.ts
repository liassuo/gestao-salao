import { useQuery } from '@tanstack/react-query';
import { cashRegisterService } from '@/services';
import type { CashRegisterFilters } from '@/types';
import { CASH_REGISTER_QUERY_KEY } from './useCashRegisterToday';

export function useCashRegisterSummary(filters?: CashRegisterFilters) {
  return useQuery({
    queryKey: [CASH_REGISTER_QUERY_KEY, 'summary', filters],
    queryFn: () => cashRegisterService.getSummary(filters),
  });
}
