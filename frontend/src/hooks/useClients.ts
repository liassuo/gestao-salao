import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsService } from '@/services';
import type { ClientFilters, CreateClientPayload, UpdateClientPayload } from '@/types';

const CLIENTS_KEY = ['clients'];

export function useClients(filters?: ClientFilters) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, filters],
    queryFn: () => clientsService.list(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, id],
    queryFn: () => clientsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateClientPayload) => clientsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateClientPayload }) =>
      clientsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}
