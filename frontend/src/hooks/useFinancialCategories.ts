import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialCategoriesService } from '@/services';
import type { FinancialCategoryFilters, CreateFinancialCategoryPayload, UpdateFinancialCategoryPayload } from '@/types';

const FINANCIAL_CATEGORIES_KEY = ['financial-categories'];

export function useFinancialCategories(filters?: FinancialCategoryFilters) {
  return useQuery({
    queryKey: [...FINANCIAL_CATEGORIES_KEY, filters],
    queryFn: () => financialCategoriesService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFinancialCategory(id: string) {
  return useQuery({
    queryKey: [...FINANCIAL_CATEGORIES_KEY, id],
    queryFn: () => financialCategoriesService.getById(id),
    enabled: !!id,
  });
}

export function useCreateFinancialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFinancialCategoryPayload) => financialCategoriesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_CATEGORIES_KEY });
    },
  });
}

export function useUpdateFinancialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFinancialCategoryPayload }) =>
      financialCategoriesService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_CATEGORIES_KEY });
    },
  });
}

export function useDeleteFinancialCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financialCategoriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_CATEGORIES_KEY });
    },
  });
}
