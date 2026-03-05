import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promotionsService } from '@/services';
import type { CreatePromotionPayload, UpdatePromotionPayload } from '@/types';

const PROMOTIONS_KEY = ['promotions'];
const TEMPLATES_KEY = ['promotions', 'templates'];

export function usePromotions(filters?: { status?: string; isTemplate?: boolean }) {
  return useQuery({
    queryKey: [...PROMOTIONS_KEY, filters],
    queryFn: () => promotionsService.list(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePromotion(id: string) {
  return useQuery({
    queryKey: [...PROMOTIONS_KEY, id],
    queryFn: () => promotionsService.getById(id),
    enabled: !!id,
  });
}

export function useActivePromotions() {
  return useQuery({
    queryKey: [...PROMOTIONS_KEY, 'active'],
    queryFn: promotionsService.getActive,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePromotionTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: promotionsService.getTemplates,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePromotionPayload) => promotionsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePromotionPayload }) =>
      promotionsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => promotionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
  });
}

export function useClonePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, overrides }: { templateId: string; overrides: Partial<CreatePromotionPayload> }) =>
      promotionsService.cloneFromTemplate(templateId, overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
    },
  });
}

export function useUploadBanner() {
  return useMutation({
    mutationFn: (file: File) => promotionsService.uploadBanner(file),
  });
}
