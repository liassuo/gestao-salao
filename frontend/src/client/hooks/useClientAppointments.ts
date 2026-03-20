import { useState, useCallback, useMemo } from 'react';
import { appointmentsApi } from '../services/appointments';
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
      const appointment = await appointmentsApi.create(data);
      return appointment;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao criar agendamento';
      throw new Error(msg);
    }
  }, []);

  // Separar agendamentos
  const { upcomingAppointments, pastAppointments, nextAppointment } = useMemo(() => {
    const now = new Date();

    const upcoming = appointments.filter((a) => {
      const date = new Date(a.scheduledAt);
      return date >= now && a.status === 'SCHEDULED';
    }).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const past = appointments.filter((a) => {
      const date = new Date(a.scheduledAt);
      return date < now || a.status !== 'SCHEDULED';
    }).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

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
