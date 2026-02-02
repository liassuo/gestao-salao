import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchesService } from '@/services';
import type { CreateBranchPayload, UpdateBranchPayload } from '@/types';

const BRANCHES_KEY = ['branches'];

export function useBranches() {
  return useQuery({
    queryKey: BRANCHES_KEY,
    queryFn: () => branchesService.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveBranches() {
  return useQuery({
    queryKey: [...BRANCHES_KEY, 'active'],
    queryFn: () => branchesService.listActive(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: [...BRANCHES_KEY, id],
    queryFn: () => branchesService.getById(id),
    enabled: !!id,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBranchPayload) => branchesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_KEY });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBranchPayload }) =>
      branchesService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_KEY });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BRANCHES_KEY });
    },
  });
}
