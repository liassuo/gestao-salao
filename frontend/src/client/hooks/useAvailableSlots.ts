import { useState, useCallback, useMemo } from 'react';
import { appointmentsApi } from '../services/appointments';
import type { TimeSlot } from '../types';

export function useAvailableSlots() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async (professionalId: string, date: string, duration?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.getAvailableSlots(professionalId, date, duration);
      setSlots(data);
    } catch (err) {
      const message = 'Não foi possível carregar os horários disponíveis';
      setError(message);
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSlots = useCallback(() => {
    setSlots([]);
  }, []);

  const availableSlots = useMemo(() => slots.filter((s) => s.available), [slots]);

  return {
    slots,
    availableSlots,
    isLoading,
    error,
    fetchSlots,
    clearSlots,
  };
}
