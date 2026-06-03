import { useQuery } from '@tanstack/react-query';
import { cashRegisterService } from '@/services';
import { CASH_REGISTER_QUERY_KEY } from './useCashRegisterToday';

/**
 * Relação detalhada dos atendimentos/pagamentos que compõem a receita de um caixa.
 * `enabled` permite carregar só quando o usuário abre o detalhe (lazy).
 */
export function useCashRegisterTransactions(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [CASH_REGISTER_QUERY_KEY, 'transactions', id],
    queryFn: () => cashRegisterService.getTransactions(id!),
    enabled: !!id && enabled,
  });
}
