import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Lock, Trash2, AlertCircle, Loader2, User, CalendarPlus, Smartphone, Monitor } from 'lucide-react';
import { useCalendarData, useDeleteTimeBlock, useAppointmentActions, useUpdateAppointment } from '@/hooks';
import { useToast } from '@/components/ui';
import { BlockTimeModal } from './BlockTimeModal';
import { AppointmentDetailModal } from './AppointmentDetailModal';
import type { CalendarAppointment, CalendarTimeBlock, CalendarProfessional } from '@/types';

const SLOT_HEIGHT = 20; // px per 10-min slot
const HOUR_HEIGHT = SLOT_HEIGHT * 6; // 120px per hour
const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 14 hours
const TIME_LABEL_WIDTH = 60; // px

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getTopPosition(time: string): number {
  const minutes = timeToMinutes(time);
  const startMinutes = START_HOUR * 60;
  return ((minutes - startMinutes) / 10) * SLOT_HEIGHT;
}

function getBlockHeight(durationMinutes: number): number {
  return (durationMinutes / 10) * SLOT_HEIGHT;
}

function extractTime(isoString: string): string {
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  // variantes de SCHEDULED (agendado)
  SUBSCRIPTION: { bg: 'bg-[#C8923A]/20', border: 'border-[#C8923A]/40', text: 'text-[#D4A85C]' }, // âmbar — assinatura
  CASH_PENDING: { bg: 'bg-green-500/15',  border: 'border-green-500/30',  text: 'text-green-400' }, // verde — pagar no local
  PAID:         { bg: 'bg-yellow-400/15', border: 'border-yellow-400/30', text: 'text-yellow-300' }, // amarelo — já pagou
  // status de agendamento
  PENDING_PAYMENT: { bg: 'bg-blue-500/15', border: 'border-blue-500/30',  text: 'text-blue-400'  }, // azul — aguardando PIX/cartão
  ATTENDED:        { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400' },
  CANCELLED:       { bg: 'bg-red-500/15',   border: 'border-[#A63030]/30', text: 'text-[#C45050]' },
  CANCELED:        { bg: 'bg-red-500/15',   border: 'border-[#A63030]/30', text: 'text-[#C45050]' },
  NO_SHOW:         { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400' },
  SCHEDULED:       { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400' }, // fallback
};

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

interface AppointmentBlockProps {
  appointment: CalendarAppointment;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

function AppointmentBlock({ appointment, onAppointmentClick }: AppointmentBlockProps) {
  const time = extractTime(appointment.scheduledAt);
  const top = getTopPosition(time);
  const height = getBlockHeight(appointment.totalDuration);
  const isSubscription = !!appointment.usedSubscriptionCut && appointment.status === 'SCHEDULED';
  const colorKey = appointment.status !== 'SCHEDULED'
    ? appointment.status
    : isSubscription
      ? 'SUBSCRIPTION'
      : appointment.isPaid
        ? 'PAID'
        : 'CASH_PENDING';
  const colors = statusColors[colorKey] || statusColors.SCHEDULED;
  const serviceNames = (appointment.services || []).map((s) => s.service?.name || 'Serviço').join(', ');
  const endMinutes = timeToMinutes(time) + appointment.totalDuration;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  const isFromClient = appointment.source === 'CLIENT';

  return (
    <div
      className={`absolute left-1 right-1 cursor-pointer overflow-hidden rounded-lg border ${colors.border} ${colors.bg} px-2 py-1 backdrop-blur-sm transition-all duration-150 hover:z-20 hover:shadow-lg`}
      style={{ top: `${top}px`, height: `${Math.max(height, SLOT_HEIGHT)}px` }}
      title={`${appointment.client?.name || 'Cliente'} - ${serviceNames} (${time} - ${endTime})${isFromClient ? ' · App' : ' · Painel'}${isSubscription ? ' · Assinatura' : ''}${appointment.status === 'PENDING_PAYMENT' ? ' · Aguardando pagamento' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onAppointmentClick(appointment);
      }}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className={`truncate text-xs font-semibold ${colors.text}`}>
          {appointment.client?.name || 'Cliente'}
        </div>
        {height >= 40 && (
          <div className="flex items-center gap-1 overflow-hidden">
            <span className={`shrink-0 ${colors.text} opacity-70`} title={isFromClient ? 'Agendado pelo app' : 'Agendado pelo painel'}>
              {isFromClient
                ? <Smartphone className="h-2.5 w-2.5" />
                : <Monitor className="h-2.5 w-2.5" />}
            </span>
            <span className="truncate text-[10px] text-[var(--text-muted)]">{serviceNames}</span>
          </div>
        )}
        {height >= 60 && (
          <div className="mt-auto flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Clock className="h-2.5 w-2.5" />
            {time} - {endTime}
          </div>
        )}
        {height >= 80 && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            {formatCurrency(appointment.totalPrice)}
            {appointment.isPaid && (
              <span className="rounded bg-emerald-500/20 px-1 text-emerald-400">Pago</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TimeBlockItemProps {
  block: CalendarTimeBlock;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function TimeBlockItem({ block, onDelete, isDeleting }: TimeBlockItemProps) {
  const startTime = extractTime(block.startTime);
  const endTime = extractTime(block.endTime);
  const top = getTopPosition(startTime);
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  const height = getBlockHeight(durationMinutes);

  return (
    <div
      className="group absolute left-1 right-1 overflow-hidden rounded-lg border border-[#A63030]/30 bg-red-500/10 px-2 py-1 backdrop-blur-sm"
      style={{
        top: `${top}px`,
        height: `${Math.max(height, SLOT_HEIGHT)}px`,
        backgroundImage:
          'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(239, 68, 68, 0.08) 4px, rgba(239, 68, 68, 0.08) 8px)',
      }}
      title={block.reason || 'Horário bloqueado'}
    >
      <div className="flex h-full items-start justify-between">
        <div className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center gap-1 truncate text-xs font-medium text-[#C45050]">
            <Lock className="h-2.5 w-2.5 shrink-0" />
            Bloqueado
          </div>
          {height >= 40 && block.reason && (
            <div className="truncate text-[10px] text-[#C45050]/70">{block.reason}</div>
          )}
          {height >= 60 && (
            <div className="mt-auto text-[10px] text-[#C45050]/60">
              {startTime} - {endTime}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          disabled={isDeleting}
          className="shrink-0 rounded p-0.5 text-[#C45050]/60 opacity-0 transition-opacity hover:bg-red-500/20 hover:text-[#C45050] group-hover:opacity-100"
          title="Remover bloqueio"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

interface CurrentTimeLineProps {
  isToday: boolean;
}

function CurrentTimeLine({ isToday }: CurrentTimeLineProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  if (!isToday) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = START_HOUR * 60;
  const endMinutes = END_HOUR * 60;

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) return null;

  const top = ((currentMinutes - startMinutes) / 10) * SLOT_HEIGHT;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-30"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <div className="h-2.5 w-2.5 rounded-full bg-[#C8923A]" />
        <div className="h-[2px] flex-1 bg-[#C8923A]" />
      </div>
    </div>
  );
}

interface CalendarViewProps {
  onNewAppointment?: (prefill: { professionalId: string; date: string; time: string }) => void;
}

export function CalendarView({ onNewAppointment }: CalendarViewProps = {}) {
  const [selectedDate, setSelectedDate] = useState(getTodayStr);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalProfessionalId, setBlockModalProfessionalId] = useState<string | null>(null);
  const [blockModalDefaultTime, setBlockModalDefaultTime] = useState<string | null>(null);
  const [slotChoice, setSlotChoice] = useState<{ professionalId: string; time: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [detailModal, setDetailModal] = useState<{
    appointment: CalendarAppointment;
    professionalName: string;
  } | null>(null);

  const { data: professionals, isLoading, isError, error } = useCalendarData(selectedDate);
  const deleteTimeBlock = useDeleteTimeBlock();
  const { cancel, attend, noShow } = useAppointmentActions();
  const updateAppointment = useUpdateAppointment();
  const toast = useToast();

  const isToday = selectedDate === getTodayStr();
  const timeSlots = useMemo(() => generateTimeSlots(), []);
  const totalGridHeight = TOTAL_HOURS * HOUR_HEIGHT;

  // Scroll to 8am on mount / date change
  useEffect(() => {
    if (scrollRef.current) {
      const offset8am = (1) * HOUR_HEIGHT; // 8:00 is 1 hour from start (7:00)
      scrollRef.current.scrollTop = offset8am;
    }
  }, [selectedDate]);

  const handlePrevDay = () => setSelectedDate((d) => addDays(d, -1));
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const handleToday = () => setSelectedDate(getTodayStr());

  const handleDeleteBlock = async (id: string) => {
    try {
      await deleteTimeBlock.mutateAsync(id);
    } catch {
      // Error handled by mutation
    }
  };

  const handleAppointmentClick = (appointment: CalendarAppointment, professionalName: string) => {
    setDetailModal({ appointment, professionalName });
  };

  const handleDetailAttend = async (id: string) => {
    try {
      await attend(id);
      toast.success('Status atualizado', 'Agendamento marcado como atendido.');
    } catch {
      toast.error('Erro', 'Não foi possível atualizar o status.');
    }
  };

  const handleDetailCancel = async (id: string) => {
    try {
      await cancel(id);
      toast.info('Agendamento cancelado', 'O agendamento foi cancelado.');
    } catch {
      toast.error('Erro', 'Não foi possível cancelar o agendamento.');
    }
  };

  const handleDetailNoShow = async (id: string) => {
    try {
      await noShow(id);
      toast.warning('Não compareceu', 'Agendamento marcado como não compareceu.');
    } catch {
      toast.error('Erro', 'Não foi possível atualizar o status.');
    }
  };

  const handleDetailUpdate = async (id: string, data: { scheduledAt?: string; notes?: string }) => {
    try {
      await updateAppointment.mutateAsync({ id, data });
      toast.success('Agendamento atualizado', 'As alterações foram salvas.');
    } catch {
      toast.error('Erro', 'Não foi possível salvar as alterações.');
      throw new Error('update failed');
    }
  };

  const handleSlotClick = (professionalId: string, time: string) => {
    setSlotChoice({ professionalId, time });
  };

  const handleSlotChoiceBlock = () => {
    if (!slotChoice) return;
    setBlockModalProfessionalId(slotChoice.professionalId);
    setBlockModalDefaultTime(slotChoice.time);
    setSlotChoice(null);
    setBlockModalOpen(true);
  };

  const handleSlotChoiceSchedule = () => {
    if (!slotChoice) return;
    const { professionalId, time } = slotChoice;
    setSlotChoice(null);
    if (onNewAppointment) {
      onNewAppointment({ professionalId, date: selectedDate, time });
    }
  };

  const handleOpenBlockModal = () => {
    setBlockModalProfessionalId(null);
    setBlockModalDefaultTime(null);
    setBlockModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando calendario...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[#A63030]/30 bg-red-500/10 p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-[#A63030]" />
          <div>
            <h3 className="font-medium text-[#A63030]">Erro ao carregar calendario</h3>
            <p className="text-sm text-[#C45050]">
              {error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const professionalsData = professionals || [];

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 backdrop-blur-sm transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevDay}
              className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
              title="Dia anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNextDay}
              className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
              title="Próximo dia"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={handleToday}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isToday
                ? 'bg-[#8B6914] text-white'
                : 'border border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            Hoje
          </button>
          <h2 className="text-lg font-semibold capitalize text-[var(--text-primary)]">
            {formatDateBR(selectedDate)}
          </h2>
        </div>

        <button
          onClick={handleOpenBlockModal}
          className="flex items-center gap-2 rounded-lg border border-[#A63030]/30 px-3 py-1.5 text-sm font-medium text-[#C45050] transition-colors hover:bg-red-500/10"
        >
          <Lock className="h-4 w-4" />
          Bloquear Horário
        </button>
      </div>

      {/* Calendar grid */}
      {professionalsData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm">
          <div className="text-center">
            <User className="mx-auto mb-2 h-10 w-10 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">Nenhum profissional encontrado</p>
            <p className="text-sm text-[var(--text-muted)]">Cadastre profissionais para visualizar o calendario</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm transition-colors duration-200">
          {/* Professional headers */}
          <div className="flex border-b border-[var(--card-border)]">
            <div
              className="shrink-0 border-r border-[var(--card-border)] bg-[var(--bg-primary)]"
              style={{ width: `${TIME_LABEL_WIDTH}px` }}
            />
            {professionalsData.map((prof) => (
              <div
                key={prof.id}
                className="flex min-w-[180px] flex-1 items-center justify-center gap-2 border-r border-[var(--card-border)] bg-[var(--bg-primary)] px-3 py-3 last:border-r-0"
              >
                {prof.avatarUrl ? (
                  <img src={prof.avatarUrl} alt={prof.name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C8923A]/20 text-xs font-bold text-[#D4A85C]">
                    {prof.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {prof.name}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {(prof.appointments || []).length} agendamento{(prof.appointments || []).length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable grid */}
          <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            <div className="relative flex" style={{ height: `${totalGridHeight}px` }}>
              {/* Time labels */}
              <div
                className="sticky left-0 z-10 shrink-0 border-r border-[var(--card-border)] bg-[var(--card-bg)]"
                style={{ width: `${TIME_LABEL_WIDTH}px` }}
              >
                {timeSlots.map((slot) => {
                  const [, m] = slot.split(':');
                  const isFullHour = m === '00';
                  const isHalfHour = m === '30';
                  if (!isFullHour && !isHalfHour) return null;

                  const top = getTopPosition(slot);
                  return (
                    <div
                      key={slot}
                      className="absolute right-2 flex items-center"
                      style={{ top: `${top - 8}px` }}
                    >
                      <span
                        className={`text-xs ${
                          isFullHour
                            ? 'font-medium text-[var(--text-secondary)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {slot}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Professional columns */}
              {professionalsData.map((prof) => (
                <ProfessionalColumn
                  key={prof.id}
                  professional={prof}
                  timeSlots={timeSlots}
                  totalGridHeight={totalGridHeight}
                  isToday={isToday}
                  selectedDate={selectedDate}
                  onDeleteBlock={handleDeleteBlock}
                  isDeletingBlock={deleteTimeBlock.isPending}
                  onSlotClick={handleSlotClick}
                  onAppointmentClick={handleAppointmentClick}
                />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 border-t border-[var(--card-border)] bg-[var(--bg-primary)] px-4 py-2.5">
            <span className="text-xs text-[var(--text-muted)]">Legenda:</span>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-[#C8923A]/40 bg-[#C8923A]/20" />
              <span className="text-xs text-[var(--text-muted)]">Agendado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-emerald-500/40 bg-emerald-500/20" />
              <span className="text-xs text-[var(--text-muted)]">Atendido</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-amber-500/30 bg-amber-500/15" />
              <span className="text-xs text-[var(--text-muted)]">Faltou</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-[#A63030]/30 bg-red-500/15" />
              <span className="text-xs text-[var(--text-muted)]">Cancelado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded border border-[#A63030]/30 bg-red-500/10"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(239, 68, 68, 0.15) 2px, rgba(239, 68, 68, 0.15) 4px)',
                }}
              />
              <span className="text-xs text-[var(--text-muted)]">Bloqueado</span>
            </div>
          </div>
        </div>
      )}

      {/* Slot action choice dialog */}
      {slotChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSlotChoice(null)} />
          <div className="relative z-10 w-80 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">
              O que deseja fazer?
            </h3>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              {slotChoice.time} — escolha uma ação para este horário
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSlotChoiceSchedule}
                className="flex items-center gap-3 rounded-xl border border-[#C8923A]/30 bg-[#C8923A]/10 px-4 py-3 text-left transition-colors hover:bg-[#C8923A]/20"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C8923A]/20">
                  <CalendarPlus className="h-4 w-4 text-[#C8923A]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Novo Agendamento</p>
                  <p className="text-xs text-[var(--text-muted)]">Agendar um cliente neste horário</p>
                </div>
              </button>
              <button
                onClick={handleSlotChoiceBlock}
                className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-4 py-3 text-left transition-colors hover:bg-[var(--card-border)]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card-border)]">
                  <Lock className="h-4 w-4 text-[var(--text-muted)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Bloquear Horário</p>
                  <p className="text-xs text-[var(--text-muted)]">Marcar como indisponível</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block time modal */}
      <BlockTimeModal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        professionals={professionalsData}
        defaultProfessionalId={blockModalProfessionalId}
        defaultTime={blockModalDefaultTime}
        selectedDate={selectedDate}
      />

      {/* Appointment detail modal */}
      <AppointmentDetailModal
        isOpen={!!detailModal}
        appointment={detailModal?.appointment ?? null}
        professionalName={detailModal?.professionalName ?? ''}
        onClose={() => setDetailModal(null)}
        onAttend={handleDetailAttend}
        onCancel={handleDetailCancel}
        onNoShow={handleDetailNoShow}
        onUpdate={handleDetailUpdate}
      />
    </div>
  );
}

interface ProfessionalColumnProps {
  professional: CalendarProfessional;
  timeSlots: string[];
  totalGridHeight: number;
  isToday: boolean;
  selectedDate: string;
  onDeleteBlock: (id: string) => void;
  isDeletingBlock: boolean;
  onSlotClick: (professionalId: string, time: string) => void;
  onAppointmentClick: (appointment: CalendarAppointment, professionalName: string) => void;
}

function ProfessionalColumn({
  professional,
  timeSlots,
  totalGridHeight,
  isToday,
  selectedDate,
  onDeleteBlock,
  isDeletingBlock,
  onSlotClick,
  onAppointmentClick,
}: ProfessionalColumnProps) {
  return (
    <div className="relative min-w-[180px] flex-1 border-r border-[var(--card-border)] last:border-r-0">
      {/* Grid lines and clickable slots */}
      {timeSlots.map((slot) => {
        const [, m] = slot.split(':');
        const isFullHour = m === '00';
        const isHalfHour = m === '30';
        const top = getTopPosition(slot);

        return (
          <div
            key={slot}
            className="absolute left-0 right-0 cursor-pointer transition-colors hover:bg-[var(--hover-bg)]"
            style={{ top: `${top}px`, height: `${SLOT_HEIGHT}px` }}
            onClick={() => onSlotClick(professional.id, slot)}
          >
            {isFullHour && (
              <div className="absolute inset-x-0 top-0 border-t border-[var(--border-color)]" />
            )}
            {isHalfHour && (
              <div className="absolute inset-x-0 top-0 border-t border-[var(--border-color)] opacity-30" />
            )}
          </div>
        );
      })}

      {/* Working hours shading (outside hours) */}
      {professional.workingHours && professional.workingHours.length > 0 && (
        <WorkingHoursOverlay
          workingHours={professional.workingHours}
          selectedDate={selectedDate}
          totalGridHeight={totalGridHeight}
        />
      )}

      {/* Appointments */}
      {(professional.appointments || []).map((apt) => (
        <AppointmentBlock
          key={apt.id}
          appointment={apt}
          onAppointmentClick={(a) => onAppointmentClick(a, professional.name)}
        />
      ))}

      {/* Time blocks */}
      {(professional.timeBlocks || []).map((block) => (
        <TimeBlockItem
          key={block.id}
          block={block}
          onDelete={onDeleteBlock}
          isDeleting={isDeletingBlock}
        />
      ))}

      {/* Current time line */}
      <CurrentTimeLine isToday={isToday} />
    </div>
  );
}

interface WorkingHoursOverlayProps {
  workingHours: { dayOfWeek: number; startTime: string; endTime: string }[];
  selectedDate: string;
  totalGridHeight: number;
}

function WorkingHoursOverlay({ workingHours, selectedDate, totalGridHeight }: WorkingHoursOverlayProps) {
  // Get day of week for the selected date (0 = Sunday)
  const [y, m, d] = selectedDate.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();

  const todayHours = workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
  if (!todayHours) {
    // Professional doesn't work this day - shade the whole column
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-[var(--text-muted)] opacity-[0.04]"
        style={{ height: `${totalGridHeight}px` }}
      />
    );
  }

  const workStart = getTopPosition(todayHours.startTime);
  const workEnd = getTopPosition(todayHours.endTime);

  return (
    <>
      {/* Before working hours */}
      {workStart > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-[var(--text-muted)] opacity-[0.04]"
          style={{ height: `${workStart}px` }}
        />
      )}
      {/* After working hours */}
      {workEnd < totalGridHeight && (
        <div
          className="pointer-events-none absolute inset-x-0 bg-[var(--text-muted)] opacity-[0.04]"
          style={{ top: `${workEnd}px`, height: `${totalGridHeight - workEnd}px` }}
        />
      )}
    </>
  );
}
