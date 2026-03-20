import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { professionalsService } from '@/services';
import type { CreateProfessionalPayload, UpdateProfessionalPayload } from '@/types';

const PROFESSIONALS_KEY = ['professionals'];

export function useProfessionals(serviceId?: string, isActive?: string) {
  return useQuery({
    queryKey: [...PROFESSIONALS_KEY, serviceId, isActive],
    queryFn: () => professionalsService.list(serviceId, isActive),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProfessional(id: string) {
  return useQuery({
    queryKey: [...PROFESSIONALS_KEY, id],
    queryFn: () => professionalsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateProfessional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProfessionalPayload) => professionalsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFESSIONALS_KEY });
    },
  });
}

export function useUpdateProfessional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProfessionalPayload }) =>
      professionalsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFESSIONALS_KEY });
    },
  });
}

export function useDeleteProfessional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFESSIONALS_KEY });
    },
  });
}
