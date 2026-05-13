import { Calendar } from 'lucide-react';
import type { Appointment } from '@/types';
import { appointmentStatusLabels, appointmentStatusColors } from '@/types';
import { EmptyState } from '@/components/ui';
import { formatPhone } from '@/utils/format';
import { AppointmentActions } from './AppointmentActions';

interface AppointmentsTableProps {
  appointments: Appointment[];
  onAttend: (id: string, paymentMethod?: string) => Promise<unknown>;
  onCancel: (id: string) => Promise<unknown>;
  onNoShow: (id: string) => Promise<unknown>;
  onGenerateDebt?: (appointment: Appointment) => void;
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
  onGenerateDebt,
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
      {/* Tabela (desktop / tablet paisagem >= 1024px). */}
      <div className="hidden overflow-x-auto lg:block">
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
                      {appointment.client?.name || appointment.clientName || 'Cliente'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatPhone(appointment.client?.phone) || '-'}
                    </p>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">
                  {appointment.professional?.name || 'Profissional'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(appointment.services || []).map((s) => (
                      <span
                        key={s.id}
                        className="inline-block rounded bg-zinc-500/20 px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        {s.service?.name || 'Serviço'}
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
                    onGenerateDebt={onGenerateDebt}
                    disabled={isLoading}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card list (mobile + tablet retrato < 1024px). 8 colunas nao cabem
          em 768-1023px sem rolagem horizontal cansativa. */}
      <ul className="divide-y divide-[var(--border-color)] lg:hidden">
        {appointments.map((appointment) => (
          <li key={appointment.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                {/* Linha 1: data/hora + status */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {formatDateTime(appointment.scheduledAt)}
                  </span>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      appointmentStatusColors[appointment.status]
                    }`}
                  >
                    {appointmentStatusLabels[appointment.status]}
                  </span>
                  {appointment.isPaid && (
                    <span className="inline-flex shrink-0 rounded-full bg-[#C8923A]/20 px-2 py-0.5 text-[10px] font-medium text-[#C8923A]">
                      Pago
                    </span>
                  )}
                </div>
                {/* Linha 2: cliente + telefone */}
                <div className="text-sm text-[var(--text-primary)]">
                  <span className="font-medium">
                    {appointment.client?.name || appointment.clientName || 'Cliente'}
                  </span>
                  {appointment.client?.phone && (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {formatPhone(appointment.client.phone)}
                    </span>
                  )}
                </div>
                {/* Linha 3: profissional + valor */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                  <span>com {appointment.professional?.name || 'Profissional'}</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {formatCurrency(appointment.totalPrice)}
                  </span>
                </div>
                {/* Linha 4: servicos */}
                {(appointment.services || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {(appointment.services || []).map((s) => (
                      <span
                        key={s.id}
                        className="inline-block rounded bg-zinc-500/20 px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                      >
                        {s.service?.name || 'Serviço'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Ações: kebab/menu — o componente ja lida com posicionamento. */}
              <div className="shrink-0">
                <AppointmentActions
                  appointment={appointment}
                  onAttend={onAttend}
                  onCancel={onCancel}
                  onNoShow={onNoShow}
                  onGenerateDebt={onGenerateDebt}
                  disabled={isLoading}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
