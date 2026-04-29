import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsService } from '@/services';
import type { AppointmentFilters, CreateTimeBlockPayload, CreateTimeBlockRangePayload } from '@/types';

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
    queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
  };

  const cancelMutation = useMutation({
    mutationFn: appointmentsService.cancel,
    onSuccess: invalidate,
  });

  const attendMutation = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: string; paymentMethod?: string }) =>
      appointmentsService.attend(id, paymentMethod),
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

export function useCalendarData(date: string) {
  return useQuery({
    queryKey: ['appointments-calendar', date],
    queryFn: () => appointmentsService.getCalendar(date),
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { scheduledAt?: string; notes?: string; professionalId?: string } }) =>
      appointmentsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });
}

export function useCreateTimeBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTimeBlockPayload) => appointmentsService.createTimeBlock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });
}

export function useCreateTimeBlockRange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTimeBlockRangePayload) =>
      appointmentsService.createTimeBlockRange(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });
}

export function useDeleteTimeBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appointmentsService.deleteTimeBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });
}
