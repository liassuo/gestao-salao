import { useState, useCallback, useMemo } from 'react';
import { appointmentsApi } from '../services/appointments';
import { safeParseDate } from '../utils/format';
import type { Appointment, CreateAppointmentData } from '../types';

export function useClientAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.getMyAppointments();
      setAppointments(data);
    } catch (err) {
      const message = 'Não foi possível carregar seus agendamentos';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelAppointment = useCallback(async (id: string) => {
    try {
      await appointmentsApi.cancel(id);
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === id ? { ...apt, status: 'CANCELED' as const } : apt
        )
      );
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  const createAppointment = useCallback(async (data: CreateAppointmentData) => {
    try {
      return await appointmentsApi.create(data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao criar agendamento';
      throw new Error(msg);
    }
  }, []);

  // Separar agendamentos
  // IMPORTANTE: usar safeParseDate. O backend grava local-time mas a coluna é
  // timestamptz, então a API devolve com sufixo Z/+00:00. Sem o strip, um
  // agendamento das 18:00 BRT é interpretado como 15:00 BRT e cai no passado.
  const { upcomingAppointments, pastAppointments, nextAppointment } = useMemo(() => {
    const now = new Date();

    const activeStatuses = ['SCHEDULED', 'PENDING_PAYMENT'];

    const upcoming = appointments.filter((a) => {
      const date = safeParseDate(a.scheduledAt);
      return date >= now && activeStatuses.includes(a.status);
    }).sort((a, b) => safeParseDate(a.scheduledAt).getTime() - safeParseDate(b.scheduledAt).getTime());

    const past = appointments.filter((a) => {
      const date = safeParseDate(a.scheduledAt);
      return date < now || !activeStatuses.includes(a.status);
    }).sort((a, b) => safeParseDate(b.scheduledAt).getTime() - safeParseDate(a.scheduledAt).getTime());

    return {
      upcomingAppointments: upcoming,
      pastAppointments: past,
      nextAppointment: upcoming[0] || null,
    };
  }, [appointments]);

  return {
    appointments,
    upcomingAppointments,
    pastAppointments,
    nextAppointment,
    isLoading,
    error,
    fetchAppointments,
    cancelAppointment,
    createAppointment,
  };
}
