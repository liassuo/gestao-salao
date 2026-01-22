import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesService } from '@/services';
import type { CreateServicePayload, UpdateServicePayload } from '@/types';

const SERVICES_KEY = ['services'];

export function useServices() {
  return useQuery({
    queryKey: SERVICES_KEY,
    queryFn: servicesService.list,
    staleTime: 5 * 60 * 1000,
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: [...SERVICES_KEY, id],
    queryFn: () => servicesService.getById(id),
    enabled: !!id,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateServicePayload) => servicesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_KEY });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServicePayload }) =>
      servicesService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_KEY });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => servicesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICES_KEY });
    },
  });
}
