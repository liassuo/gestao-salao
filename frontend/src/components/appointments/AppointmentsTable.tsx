import { Calendar } from 'lucide-react';
import type { Appointment } from '@/types';
import { appointmentStatusLabels, appointmentStatusColors } from '@/types';
import { EmptyState } from '@/components/ui';
import { AppointmentActions } from './AppointmentActions';

interface AppointmentsTableProps {
  appointments: Appointment[];
  onAttend: (id: string) => Promise<unknown>;
  onCancel: (id: string) => Promise<unknown>;
  onNoShow: (id: string) => Promise<unknown>;
  isLoading?: boolean;
  onNewAppointment?: () => void;
}

function formatDateTime(dateTime: string): string {
  const date = new Date(dateTime);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function AppointmentsTable({
  appointments,
  onAttend,
  onCancel,
  onNoShow,
  isLoading,
  onNewAppointment,
}: AppointmentsTableProps) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Nenhum agendamento encontrado"
        description="Você ainda não possui agendamentos para este período. Que tal criar um novo?"
        action={onNewAppointment ? { label: 'Novo Agendamento', onClick: onNewAppointment } : undefined}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Data/Hora
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Profissional
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Serviços
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Pago
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {formatDateTime(appointment.scheduledAt)}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {appointment.client.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {appointment.client.phone}
                    </p>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {appointment.professional.name}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {appointment.services.map((s) => (
                      <span
                        key={s.id}
                        className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                      >
                        {s.service.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {formatCurrency(appointment.totalPrice)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      appointmentStatusColors[appointment.status]
                    }`}
                  >
                    {appointmentStatusLabels[appointment.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {appointment.isPaid ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Sim
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                      Não
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <AppointmentActions
                    appointment={appointment}
                    onAttend={onAttend}
                    onCancel={onCancel}
                    onNoShow={onNoShow}
                    disabled={isLoading}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
