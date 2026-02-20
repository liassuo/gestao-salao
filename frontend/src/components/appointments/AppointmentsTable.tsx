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
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--hover-bg)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Data/Hora
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Profissional
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Serviços
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Pago
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="hover:bg-[var(--hover-bg)]">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">
                  {formatDateTime(appointment.scheduledAt)}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {appointment.client.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {appointment.client.phone}
                    </p>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">
                  {appointment.professional.name}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {appointment.services.map((s) => (
                      <span
                        key={s.id}
                        className="inline-block rounded bg-zinc-500/20 px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        {s.service.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
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
                    <span className="inline-flex rounded-full bg-[#C8923A]/20 px-2.5 py-0.5 text-xs font-medium text-[#C8923A]">
                      Sim
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-[#A63030]">
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
