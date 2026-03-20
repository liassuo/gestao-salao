import { useState, useCallback } from 'react';
import { professionalsApi } from '../services/professionals';
import type { Professional } from '../types';

export function useClientProfessionals() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfessionals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await professionalsApi.getAll();
      setProfessionals(data);
    } catch (err) {
      const message = 'Não foi possível carregar os profissionais';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAvailableProfessionals = useCallback(async (serviceIds: string[], date: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await professionalsApi.getAvailableForBooking(serviceIds, date);
      setProfessionals(data);
    } catch (err) {
      const message = 'Não foi possível carregar os profissionais';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    professionals,
    isLoading,
    error,
    fetchProfessionals,
    fetchAvailableProfessionals,
  };
}
