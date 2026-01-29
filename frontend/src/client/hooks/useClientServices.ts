import { useState, useCallback } from 'react';
import { servicesApi } from '../services/services';
import type { Service } from '../types';

export function useClientServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await servicesApi.getAll();
      setServices(data);
    } catch (err) {
      const message = 'Nao foi possivel carregar os servicos';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    services,
    isLoading,
    error,
    fetchServices,
  };
}
