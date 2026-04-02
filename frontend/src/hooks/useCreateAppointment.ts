import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { appointmentsService } from '@/services';
import type { CreateAppointmentPayload } from '@/types';

interface ApiError {
  message: string;
  statusCode: number;
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAppointmentPayload) =>
      appointmentsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-calendar'] });
    },
  });
}

// Helper para extrair mensagem de erro da API
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as ApiError;
    return data.message || 'Erro ao criar agendamento';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erro desconhecido';
}
