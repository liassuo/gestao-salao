import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsService } from '@/services';
import type { AppointmentFilters } from '@/types';

const QUERY_KEY = 'appointments';

export function useAppointments(filters?: AppointmentFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => appointmentsService.list(filters),
  });
}

export function useAppointmentActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
  };

  const cancelMutation = useMutation({
    mutationFn: appointmentsService.cancel,
    onSuccess: invalidate,
  });

  const attendMutation = useMutation({
    mutationFn: appointmentsService.attend,
    onSuccess: invalidate,
  });

  const noShowMutation = useMutation({
    mutationFn: appointmentsService.noShow,
    onSuccess: invalidate,
  });

  return {
    cancel: cancelMutation.mutateAsync,
    attend: attendMutation.mutateAsync,
    noShow: noShowMutation.mutateAsync,
    isLoading:
      cancelMutation.isPending ||
      attendMutation.isPending ||
      noShowMutation.isPending,
  };
}
