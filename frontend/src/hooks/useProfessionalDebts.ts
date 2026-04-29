import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { professionalDebtsService } from '@/services';
import type {
  ProfessionalDebtFilters,
  CreateProfessionalDebtPayload,
  SettleProfessionalDebtCashPayload,
} from '@/types';

const QUERY_KEY = 'professional-debts';

export function useProfessionalDebts(filters?: ProfessionalDebtFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => professionalDebtsService.list(filters),
  });
}

export function usePendingProfessionalDebts(professionalId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'pending', professionalId],
    queryFn: () => professionalDebtsService.getPendingByProfessional(professionalId!),
    enabled: !!professionalId,
  });
}

export function useProfessionalDebtSummary(professionalId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'summary', professionalId],
    queryFn: () => professionalDebtsService.getSummary(professionalId!),
    enabled: !!professionalId,
  });
}

export function useCreateProfessionalDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProfessionalDebtPayload) =>
      professionalDebtsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useSettleProfessionalDebtCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: SettleProfessionalDebtCashPayload;
    }) => professionalDebtsService.settleCash(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['cash-register'] });
    },
  });
}

export function useDeleteProfessionalDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professionalDebtsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
