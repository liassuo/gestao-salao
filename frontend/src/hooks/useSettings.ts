import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface BusinessSettings {
  openingTime: string;
  closingTime: string;
  businessName?: string;
  phone?: string;
}

export function useSettings() {
  return useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return {
        openingTime: data.openingTime || '09:00',
        closingTime: data.closingTime || '19:00',
        businessName: data.businessName,
        phone: data.phone,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
