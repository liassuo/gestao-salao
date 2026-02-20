import { Clock, DollarSign } from 'lucide-react';
import type { Service } from '@/types';

interface AppointmentSummaryProps {
  selectedServices: Service[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function AppointmentSummary({ selectedServices }: AppointmentSummaryProps) {
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || s.duration || 0), 0);

  if (selectedServices.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-[#C8923A]/10 p-4">
      <h4 className="mb-3 text-sm font-medium text-[#8B6914]">Resumo</h4>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#C8923A]">
            <Clock className="h-4 w-4" />
            <span>Duração total</span>
          </div>
          <span className="font-medium text-[#8B6914]">
            {formatDuration(totalDuration)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#C8923A]">
            <DollarSign className="h-4 w-4" />
            <span>Valor total</span>
          </div>
          <span className="text-lg font-bold text-[#8B6914]">
            {formatCurrency(totalPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}
