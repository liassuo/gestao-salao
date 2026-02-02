import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commissionsService } from '@/services';
import type { CommissionFilters, GenerateCommissionPayload } from '@/types';

const COMMISSIONS_KEY = ['commissions'];

export function useCommissions(filters?: CommissionFilters) {
  return useQuery({
    queryKey: [...COMMISSIONS_KEY, filters],
    queryFn: () => commissionsService.list(filters),
  });
}

export function useCommission(id: string) {
  return useQuery({
    queryKey: [...COMMISSIONS_KEY, id],
    queryFn: () => commissionsService.getById(id),
    enabled: !!id,
  });
}

export function useGenerateCommissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateCommissionPayload) => commissionsService.generate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMISSIONS_KEY });
    },
  });
}

export function useMarkCommissionAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commissionsService.markAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMISSIONS_KEY });
    },
  });
}

export function useDeleteCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commissionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMISSIONS_KEY });
    },
  });
}
