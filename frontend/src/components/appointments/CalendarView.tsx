import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Lock, Trash2, AlertCircle, Loader2, User, CalendarPlus, Smartphone, Monitor, CalendarDays } from 'lucide-react';
import { useCalendarData, useDeleteTimeBlock, useAppointmentActions, useUpdateAppointment, useSettings } from '@/hooks';
import { useToast, ConfirmModal } from '@/components/ui';
import { BlockTimeModal } from './BlockTimeModal';
import { AppointmentDetailModal } from './AppointmentDetailModal';
import type { CalendarAppointment, CalendarTimeBlock, CalendarProfessional } from '@/types';

const SLOT_HEIGHT = 20; // px per 10-min slot
const HOUR_HEIGHT = SLOT_HEIGHT * 6; // 120px per hour
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 21;
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

function getTopPosition(time: string, startHour = DEFAULT_START_HOUR): number {
  const minutes = timeToMinutes(time);
  const startMinutes = startHour * 60;
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

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function validateDropTarget(
  newTime: string,
  durationMinutes: number,
  professional: CalendarProfessional,
  selectedDate: string,
  excludeAppointmentId?: string,
): string | null {
  const newStart = timeToMinutes(newTime);
  const newEnd = newStart + durationMinutes;

  // Horário no passado
  const now = new Date();
  const [y, m, d] = selectedDate.split('-').map(Number);
  const isToday = y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
  if (isToday) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (newStart < nowMinutes) {
      return 'Não é possível mover para um horário que já passou.';
    }
  }

  // Dia de folga
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  const todayHours = professional.workingHours?.find((wh) => wh.dayOfWeek === dayOfWeek);

  if (professional.workingHours && professional.workingHours.length > 0 && !todayHours) {
    return 'Este profissional está de folga neste dia.';
  }

  // Fora do expediente
  if (todayHours) {
    const workStart = timeToMinutes(todayHours.startTime);
    const workEnd = timeToMinutes(todayHours.endTime);
    if (newStart < workStart || newEnd > workEnd) {
      return 'O horário está fora do expediente deste profissional.';
    }
  }

  // Conflito com bloqueio
  for (const block of professional.timeBlocks || []) {
    const blockStart = timeToMinutes(extractTime(block.startTime));
    const blockEnd = timeToMinutes(extractTime(block.endTime));
    if (newStart < blockEnd && newEnd > blockStart) {
      return 'O horário conflita com um bloqueio deste profissional.';
    }
  }

  // Conflito com outros agendamentos
  for (const appt of professional.appointments || []) {
    if (excludeAppointmentId && appt.id === excludeAppointmentId) continue;
    if (appt.status === 'CANCELED' || appt.status === 'CANCELLED' || appt.status === 'NO_SHOW') continue;
    const apptStart = timeToMinutes(extractTime(appt.scheduledAt));
    const apptEnd = apptStart + (appt.totalDuration || 30);
    if (newStart < apptEnd && newEnd > apptStart) {
      return 'O horário conflita com outro agendamento existente.';
    }
  }

  return null;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  // variantes de SCHEDULED (agendado)
  SUBSCRIPTION: { bg: 'bg-[#C8923A]/20', border: 'border-[#C8923A]/40', text: 'text-[#D4A85C]' }, // âmbar — assinatura
  CASH_PENDING: { bg: 'bg-yellow-400/15', border: 'border-yellow-400/30', text: 'text-yellow-300' }, // amarelo — agendado, pagar no local
  PAID:         { bg: 'bg-green-500/25',  border: 'border-green-500/50',  text: 'text-green-300' }, // verde forte — pago
  // status de agendamento
  PENDING_PAYMENT: { bg: 'bg-blue-500/15', border: 'border-blue-500/30',  text: 'text-blue-400'  }, // azul — aguardando PIX/cartão
  ATTENDED:        { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-500/80' }, // verde suave — atendido
  CANCELLED:       { bg: 'bg-red-500/15',   border: 'border-[#A63030]/30', text: 'text-[#C45050]' },
  CANCELED:        { bg: 'bg-red-500/15',   border: 'border-[#A63030]/30', text: 'text-[#C45050]' },
  NO_SHOW:         { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400' },
  SCHEDULED:       { bg: 'bg-yellow-400/15', border: 'border-yellow-400/30', text: 'text-yellow-300' }, // fallback
};

function generateTimeSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

interface AppointmentBlockProps {
  appointment: CalendarAppointment;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onDragStart?: (e: React.PointerEvent<HTMLDivElement>, appointment: CalendarAppointment) => void;
  isDragging?: boolean;
  startHour: number;
}

function AppointmentBlock({ appointment, onAppointmentClick, onDragStart, isDragging, startHour }: AppointmentBlockProps) {
  const time = extractTime(appointment.scheduledAt);
  const top = getTopPosition(time, startHour);
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
      className={`absolute left-1 right-1 ${appointment.status === 'SCHEDULED' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} overflow-hidden rounded-lg border ${colors.border} ${colors.bg} px-2 py-1 backdrop-blur-sm transition-all duration-150 hover:z-20 hover:shadow-lg ${isDragging ? '!opacity-30' : ''}`}
      style={{ top: `${top}px`, height: `${Math.max(height, SLOT_HEIGHT)}px` }}
      title={`${appointment.client?.name || appointment.clientName || 'Cliente'} - ${serviceNames} (${time} - ${endTime})${isFromClient ? ' · App' : ' · Painel'}${isSubscription ? ' · Assinatura' : ''}${appointment.status === 'PENDING_PAYMENT' ? ' · Aguardando pagamento' : ''}`}
      onPointerDown={(e) => {
        if (e.button === 0 && appointment.status === 'SCHEDULED') {
          onDragStart?.(e, appointment);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onAppointmentClick(appointment);
      }}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className={`truncate text-xs font-semibold ${colors.text}`}>
          {appointment.client?.name || appointment.clientName || 'Cliente'}
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
  startHour: number;
}

function TimeBlockItem({ block, onDelete, isDeleting, startHour }: TimeBlockItemProps) {
  const startTime = extractTime(block.startTime);
  const endTime = extractTime(block.endTime);
  const top = getTopPosition(startTime, startHour);
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
  startHour: number;
  endHour: number;
}

function CurrentTimeLine({ isToday, startHour, endHour }: CurrentTimeLineProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  if (!isToday) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;

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
  const dateInputRef = useRef<HTMLInputElement>(null);
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
  const { data: settings } = useSettings();
  const deleteTimeBlock = useDeleteTimeBlock();
  const { cancel, attend, noShow } = useAppointmentActions();
  const updateAppointment = useUpdateAppointment();
  const toast = useToast();

  // Horários dinâmicos baseados nas configurações
  const startHour = useMemo(() => {
    if (!settings?.openingTime) return DEFAULT_START_HOUR;
    const h = parseInt(settings.openingTime.split(':')[0], 10);
    return Math.max(0, h - 1); // 1 hora antes do início
  }, [settings?.openingTime]);

  const endHour = useMemo(() => {
    if (!settings?.closingTime) return DEFAULT_END_HOUR;
    const h = parseInt(settings.closingTime.split(':')[0], 10);
    return Math.min(24, h + 2); // 2 horas depois do fim
  }, [settings?.closingTime]);

  const totalHours = endHour - startHour;

  // Drag-and-drop state
  const [dragConfirm, setDragConfirm] = useState<{
    appointment: CalendarAppointment;
    oldTime: string;
    newTime: string;
    newProfessionalId?: string;
    newProfessionalName?: string;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragProfessionalId, setDragProfessionalId] = useState<string | null>(null);
  const [dragGhostTop, setDragGhostTop] = useState(0);
  const [dragGhostHeight, setDragGhostHeight] = useState(0);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const dragOriginalTop = useRef(0);
  const dragAppointmentRef = useRef<CalendarAppointment | null>(null);
  const dragGhostTopRef = useRef(0);
  const dragThresholdMet = useRef(false);
  const dragSourceProfessionalId = useRef<string | null>(null);
  const dragTargetProfessionalRef = useRef<string | null>(null);
  const rafId = useRef(0);

  const isToday = selectedDate === getTodayStr();
  const timeSlots = useMemo(() => generateTimeSlots(startHour, endHour), [startHour, endHour]);
  const totalGridHeight = totalHours * HOUR_HEIGHT;

  // Scroll to top on mount / date change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
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
    // Skip click if it follows a drag
    if (draggingId) return;
    setDetailModal({ appointment, professionalName });
  };

  const handleDetailAttend = async (id: string, paymentMethod?: string) => {
    try {
      await attend({ id, paymentMethod });
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
      // Atualizar o modal com os dados novos
      if (detailModal) {
        setDetailModal({
          ...detailModal,
          appointment: {
            ...detailModal.appointment,
            ...(data.scheduledAt && { scheduledAt: data.scheduledAt }),
            ...(data.notes !== undefined && { notes: data.notes || null }),
          },
        });
      }
      toast.success('Agendamento atualizado', 'As alterações foram salvas.');
    } catch {
      toast.error('Erro', 'Não foi possível salvar as alterações.');
      throw new Error('update failed');
    }
  };

  // Drag-and-drop handlers
  const handleAppointmentDragStart = (
    e: React.PointerEvent<HTMLDivElement>,
    appointment: CalendarAppointment,
    professionalId: string,
  ) => {
    if (appointment.status !== 'SCHEDULED' || dragConfirm) return;

    const time = extractTime(appointment.scheduledAt);
    const top = getTopPosition(time, startHour);
    const height = getBlockHeight(appointment.totalDuration);

    const startClientX = e.clientX;
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollRef.current?.scrollTop ?? 0;
    dragOriginalTop.current = top;
    dragAppointmentRef.current = appointment;
    dragGhostTopRef.current = top;
    dragThresholdMet.current = false;
    dragSourceProfessionalId.current = professionalId;
    dragTargetProfessionalRef.current = professionalId;

    setDragGhostTop(top);
    setDragGhostHeight(height);
    setDragProfessionalId(professionalId);

    const handleMove = (ev: PointerEvent) => {
      const deltaY = (ev.clientY - dragStartY.current)
        + ((scrollRef.current?.scrollTop ?? 0) - dragStartScrollTop.current);

      if (!dragThresholdMet.current) {
        const deltaX = Math.abs(ev.clientX - startClientX);
        if (Math.abs(deltaY) < 5 && deltaX < 5) return;
        dragThresholdMet.current = true;
        setDraggingId(appointment.id);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }

      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        // Vertical: snap to time slots
        const rawTop = dragOriginalTop.current + deltaY;
        const snappedTop = Math.round(rawTop / SLOT_HEIGHT) * SLOT_HEIGHT;
        const maxTop = totalHours * HOUR_HEIGHT - height;
        const clampedTop = Math.max(0, Math.min(snappedTop, maxTop));
        setDragGhostTop(clampedTop);
        dragGhostTopRef.current = clampedTop;

        // Horizontal: detect target professional column
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const col = el?.closest<HTMLElement>('[data-professional-id]');
        if (col) {
          const targetId = col.dataset.professionalId!;
          if (targetId !== dragTargetProfessionalRef.current) {
            dragTargetProfessionalRef.current = targetId;
            setDragProfessionalId(targetId);
          }
        }
      });
    };

    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      cancelAnimationFrame(rafId.current);

      if (dragThresholdMet.current) {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        // Prevent the click event that follows pointerup
        const preventClick = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        document.addEventListener('click', preventClick, { capture: true, once: true });

        if (dragAppointmentRef.current) {
          const finalTop = dragGhostTopRef.current;
          const newMinutes = startHour * 60 + (finalTop / SLOT_HEIGHT) * 10;
          const newTime = minutesToTimeStr(newMinutes);
          const oldTime = extractTime(dragAppointmentRef.current.scheduledAt);
          const sourceProf = dragSourceProfessionalId.current;
          const targetProf = dragTargetProfessionalRef.current;
          const professionalChanged = targetProf !== sourceProf;

          if (newTime !== oldTime || professionalChanged) {
            const targetProfData = professionalsData.find((p) => p.id === targetProf);

            // Validar destino: folga, fora do expediente, bloqueio, conflito com agendamentos
            const dropError = targetProfData
              ? validateDropTarget(newTime, dragAppointmentRef.current.totalDuration, targetProfData, selectedDate, dragAppointmentRef.current.id)
              : null;

            if (dropError) {
              toast.warning('Não é possível mover', dropError);
            } else {
              setDragConfirm({
                appointment: dragAppointmentRef.current,
                oldTime,
                newTime,
                ...(professionalChanged && targetProf && {
                  newProfessionalId: targetProf,
                  newProfessionalName: targetProfData?.name,
                }),
              });
            }
          }
        }
      }

      setDraggingId(null);
      setDragProfessionalId(null);
      dragAppointmentRef.current = null;
      dragSourceProfessionalId.current = null;
      dragTargetProfessionalRef.current = null;
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  const handleDragConfirm = async () => {
    if (!dragConfirm) return;
    const { appointment, oldTime, newTime, newProfessionalId } = dragConfirm;
    const [year, month, day] = selectedDate.split('-');
    const newScheduledAt = `${year}-${month}-${day}T${newTime}:00`;
    const timeChanged = newTime !== oldTime;

    const data: { scheduledAt?: string; professionalId?: string } = {};
    if (timeChanged) data.scheduledAt = newScheduledAt;
    if (newProfessionalId) data.professionalId = newProfessionalId;

    try {
      await updateAppointment.mutateAsync({ id: appointment.id, data });
      const parts: string[] = [];
      if (timeChanged) parts.push(`horário para ${newTime}`);
      if (newProfessionalId) parts.push(`profissional para ${dragConfirm.newProfessionalName}`);
      toast.success('Agendamento movido', `Alterado ${parts.join(' e ')}.`);
    } catch {
      toast.error('Erro', 'Não foi possível mover o agendamento.');
    }
    setDragConfirm(null);
  };

  const handleSlotClick = (professionalId: string, time: string) => {
    if (draggingId) return;
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
          <div className="relative">
            <button
              onClick={() => dateInputRef.current?.showPicker()}
              className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
              title="Escolher data"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              tabIndex={-1}
            />
          </div>
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

                  const top = getTopPosition(slot, startHour);
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
                  startHour={startHour}
                  endHour={endHour}
                  onDeleteBlock={handleDeleteBlock}
                  isDeletingBlock={deleteTimeBlock.isPending}
                  onSlotClick={handleSlotClick}
                  onAppointmentClick={handleAppointmentClick}
                  onAppointmentDragStart={handleAppointmentDragStart}
                  draggingAppointmentId={draggingId}
                  dragGhostTop={dragProfessionalId === prof.id ? dragGhostTop : undefined}
                  dragGhostHeight={dragProfessionalId === prof.id ? dragGhostHeight : undefined}
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
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded border border-gray-500/20 bg-gray-500/[0.08]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(128, 128, 128, 0.1) 2px, rgba(128, 128, 128, 0.1) 4px)',
                }}
              />
              <span className="text-xs text-[var(--text-muted)]">Fora do expediente</span>
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

      {/* Drag time change confirm modal */}
      <ConfirmModal
        isOpen={!!dragConfirm}
        onClose={() => setDragConfirm(null)}
        onConfirm={handleDragConfirm}
        title="Mover agendamento"
        message={
          dragConfirm
            ? (() => {
                const clientName = dragConfirm.appointment.client?.name || dragConfirm.appointment.clientName || 'Cliente';
                const timeChanged = dragConfirm.oldTime !== dragConfirm.newTime;
                const profChanged = !!dragConfirm.newProfessionalId;
                const parts: string[] = [];
                if (timeChanged) parts.push(`horário de ${dragConfirm.oldTime} para ${dragConfirm.newTime}`);
                if (profChanged) parts.push(`profissional para ${dragConfirm.newProfessionalName}`);
                return `Deseja alterar o ${parts.join(' e o ')} do agendamento de ${clientName}?`;
              })()
            : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        variant="info"
        isLoading={updateAppointment.isPending}
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
  startHour: number;
  endHour: number;
  onDeleteBlock: (id: string) => void;
  isDeletingBlock: boolean;
  onSlotClick: (professionalId: string, time: string) => void;
  onAppointmentClick: (appointment: CalendarAppointment, professionalName: string) => void;
  onAppointmentDragStart?: (e: React.PointerEvent<HTMLDivElement>, appointment: CalendarAppointment, professionalId: string) => void;
  draggingAppointmentId?: string | null;
  dragGhostTop?: number;
  dragGhostHeight?: number;
}

function ProfessionalColumn({
  professional,
  timeSlots,
  totalGridHeight,
  isToday,
  selectedDate,
  startHour,
  endHour,
  onDeleteBlock,
  isDeletingBlock,
  onSlotClick,
  onAppointmentClick,
  onAppointmentDragStart,
  draggingAppointmentId,
  dragGhostTop,
  dragGhostHeight,
}: ProfessionalColumnProps) {
  return (
    <div data-professional-id={professional.id} className="relative min-w-[180px] flex-1 border-r border-[var(--card-border)] last:border-r-0">
      {/* Grid lines and clickable slots */}
      {timeSlots.map((slot) => {
        const [, m] = slot.split(':');
        const isFullHour = m === '00';
        const isHalfHour = m === '30';
        const top = getTopPosition(slot, startHour);

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
      <WorkingHoursOverlay
        workingHours={professional.workingHours}
        selectedDate={selectedDate}
        totalGridHeight={totalGridHeight}
        startHour={startHour}
      />

      {/* Appointments */}
      {(professional.appointments || []).map((apt) => (
        <AppointmentBlock
          key={apt.id}
          appointment={apt}
          onAppointmentClick={(a) => onAppointmentClick(a, professional.name)}
          onDragStart={onAppointmentDragStart ? (e, a) => onAppointmentDragStart(e, a, professional.id) : undefined}
          isDragging={draggingAppointmentId === apt.id}
          startHour={startHour}
        />
      ))}

      {/* Time blocks */}
      {(professional.timeBlocks || []).map((block) => (
        <TimeBlockItem
          key={block.id}
          block={block}
          onDelete={onDeleteBlock}
          isDeleting={isDeletingBlock}
          startHour={startHour}
        />
      ))}

      {/* Current time line */}
      <CurrentTimeLine isToday={isToday} startHour={startHour} endHour={endHour} />

      {/* Drag ghost */}
      {draggingAppointmentId && dragGhostTop !== undefined && dragGhostHeight !== undefined && (
        <div
          className="pointer-events-none absolute left-1 right-1 z-30 rounded-lg border-2 border-dashed border-[#C8923A] bg-[#C8923A]/10 px-2 py-1"
          style={{ top: `${dragGhostTop}px`, height: `${Math.max(dragGhostHeight, SLOT_HEIGHT)}px` }}
        >
          <div className="flex h-full items-center gap-1 text-xs font-semibold text-[#C8923A]">
            <Clock className="h-3 w-3" />
            {minutesToTimeStr(startHour * 60 + (dragGhostTop / SLOT_HEIGHT) * 10)}
          </div>
        </div>
      )}
    </div>
  );
}

const CLOSED_OVERLAY_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(128, 128, 128, 0.06) 4px, rgba(128, 128, 128, 0.06) 8px)',
};

interface WorkingHoursOverlayProps {
  workingHours: { dayOfWeek: number; startTime: string; endTime: string }[] | null;
  selectedDate: string;
  totalGridHeight: number;
  startHour: number;
}

function WorkingHoursOverlay({ workingHours, selectedDate, totalGridHeight, startHour }: WorkingHoursOverlayProps) {
  // Get day of week for the selected date (0 = Sunday)
  const [y, m, d] = selectedDate.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();

  const todayHours = workingHours?.find((wh) => wh.dayOfWeek === dayOfWeek);

  // Fallback para horário padrão se o profissional não tem workingHours definidos
  const startTime = todayHours?.startTime || '09:00';
  const endTime = todayHours?.endTime || '19:00';

  // Se não tem workingHours e nem horário para esse dia, sombrear tudo
  if (workingHours && workingHours.length > 0 && !todayHours) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-gray-500/[0.08]"
        style={{ height: `${totalGridHeight}px`, ...CLOSED_OVERLAY_STYLE }}
      >
        <div className="flex h-full items-center justify-center">
          <span className="rounded-md bg-[var(--card-bg)]/80 px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
            Folga
          </span>
        </div>
      </div>
    );
  }

  const workStart = getTopPosition(startTime, startHour);
  const workEnd = getTopPosition(endTime, startHour);

  return (
    <>
      {/* Antes do expediente */}
      {workStart > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-gray-500/[0.08]"
          style={{ height: `${workStart}px`, ...CLOSED_OVERLAY_STYLE }}
        />
      )}
      {/* Depois do expediente */}
      {workEnd < totalGridHeight && (
        <div
          className="pointer-events-none absolute inset-x-0 bg-gray-500/[0.08]"
          style={{ top: `${workEnd}px`, height: `${totalGridHeight - workEnd}px`, ...CLOSED_OVERLAY_STYLE }}
        />
      )}
    </>
  );
}
