import { useState } from 'react';
import { Clock, Phone, Check, UserX, Edit2, Save, XCircle, Loader2, Plus, Trash2, Package, Scissors } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useOrderByAppointment, useAddOrderItem, useRemoveOrderItem, useProducts, useServices } from '@/hooks';
import type { CalendarAppointment } from '@/types';

const statusConfig: Record<string, { label: string; classes: string }> = {
  SCHEDULED: { label: 'Agendado', classes: 'text-[#D4A85C] bg-[#C8923A]/20 border border-[#C8923A]/40' },
  PENDING_PAYMENT: { label: 'Pagamento Pendente', classes: 'text-blue-400 bg-blue-500/20 border border-blue-500/40' },
  ATTENDED: { label: 'Atendido', classes: 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/40' },
  CANCELLED: { label: 'Cancelado', classes: 'text-[#C45050] bg-red-500/15 border border-[#A63030]/30' },
  CANCELED: { label: 'Cancelado', classes: 'text-[#C45050] bg-red-500/15 border border-[#A63030]/30' },
  NO_SHOW: { label: 'N\u00e3o Compareceu', classes: 'text-amber-400 bg-amber-500/15 border border-amber-500/30' },
};

function formatDateBR(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function extractTime(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function extractEditValues(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

interface AppointmentDetailModalProps {
  appointment: CalendarAppointment | null;
  professionalName: string;
  isOpen: boolean;
  onClose: () => void;
  onAttend: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onNoShow: (id: string) => Promise<void>;
  onUpdate: (id: string, data: { scheduledAt?: string; notes?: string }) => Promise<void>;
}

export function AppointmentDetailModal({
  appointment,
  professionalName,
  isOpen,
  onClose,
  onAttend,
  onCancel,
  onNoShow,
  onUpdate,
}: AppointmentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isActing, setIsActing] = useState(false);

  // Comanda
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemType, setAddItemType] = useState<'SERVICE' | 'PRODUCT'>('PRODUCT');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  const { data: order, refetch: refetchOrder } = useOrderByAppointment(appointment?.id);
  const { data: products } = useProducts();
  const { data: services } = useServices();
  const addOrderItem = useAddOrderItem();
  const removeOrderItem = useRemoveOrderItem();

  if (!appointment) return null;

  const status = statusConfig[appointment.status] || statusConfig.SCHEDULED;
  const startTime = extractTime(appointment.scheduledAt);
  const endMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]) + appointment.totalDuration;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  const isScheduled = appointment.status === 'SCHEDULED' || appointment.status === 'PENDING_PAYMENT';
  const canEditOrder = order && order.status === 'PENDING';

  const handleStartEdit = () => {
    const vals = extractEditValues(appointment.scheduledAt);
    setEditDate(vals.date);
    setEditTime(vals.time);
    setEditNotes(appointment.notes || '');
    setIsEditing(true);
    setIsConfirmingCancel(false);
  };

  const handleCancelEdit = () => setIsEditing(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(appointment.id, {
        scheduledAt: `${editDate}T${editTime}:00`,
        notes: editNotes || undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (action: () => Promise<void>) => {
    setIsActing(true);
    try {
      await action();
      onClose();
    } finally {
      setIsActing(false);
    }
  };

  const handleAddItem = async () => {
    if (!order || !selectedItemId) return;
    const isProduct = addItemType === 'PRODUCT';
    const item = isProduct
      ? products?.find((p) => p.id === selectedItemId)
      : services?.find((s) => s.id === selectedItemId);
    if (!item) return;

    const unitPrice = isProduct ? (item as any).salePrice : (item as any).price;

    try {
      await addOrderItem.mutateAsync({
        orderId: order.id,
        payload: {
          productId: isProduct ? selectedItemId : undefined,
          serviceId: !isProduct ? selectedItemId : undefined,
          quantity: itemQuantity,
          unitPrice,
          itemType: addItemType,
        },
      });
      await refetchOrder();
      setShowAddItem(false);
      setSelectedItemId('');
      setItemQuantity(1);
    } catch {
      // handled by mutation
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!order) return;
    try {
      await removeOrderItem.mutateAsync({ orderId: order.id, itemId });
      await refetchOrder();
    } catch {
      // handled by mutation
    }
  };

  const inputClass =
    'w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--card-border)]';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Agendamento" size="lg">
      <div className="space-y-4">
        {/* Status + Edit */}
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.classes}`}>
            {status.label}
          </span>
          {!isEditing && isScheduled && (
            <button onClick={handleStartEdit} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]">
              <Edit2 className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Client */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Cliente</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{appointment.client?.name || '\u2014'}</div>
            {appointment.client?.phone && (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Phone className="h-3 w-3" />
                {appointment.client.phone}
              </div>
            )}
          </div>

          {/* Professional */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Profissional</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{professionalName}</div>
          </div>
        </div>

        {/* Date/Time */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Data e Hor\u00e1rio</div>
          {isEditing ? (
            <div className="flex gap-2">
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputClass} />
              <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-32 rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium capitalize text-[var(--text-primary)]">{formatDateBR(appointment.scheduledAt)}</div>
              <div className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
                <Clock className="h-3.5 w-3.5" />
                {startTime} \u2013 {endTime} ({formatDuration(appointment.totalDuration)})
              </div>
            </div>
          )}
        </div>

        {/* Notes (editing) */}
        {isEditing && (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Observa\u00e7\u00f5es</div>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Adicionar observa\u00e7\u00f5es..." rows={2} className="w-full resize-none rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]" />
          </div>
        )}

        {/* Edit save/cancel buttons */}
        {isEditing && (
          <div className="flex justify-end gap-2">
            <button onClick={handleCancelEdit} disabled={isSaving} className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-50">Cancelar</button>
            <button onClick={handleSave} disabled={isSaving || !editDate || !editTime} className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#725510] disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        )}

        {/* Comanda / Items */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Comanda</div>
            <div className="flex items-center gap-2">
              {order && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${order.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : order.status === 'CANCELED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {order.status === 'PAID' ? 'Paga' : order.status === 'CANCELED' ? 'Cancelada' : 'Pendente'}
                </span>
              )}
              {canEditOrder && (
                <button onClick={() => { setShowAddItem(!showAddItem); setSelectedItemId(''); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#C8923A] transition-colors hover:bg-[#C8923A]/10">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              )}
            </div>
          </div>

          {/* Items list */}
          {order?.items && order.items.length > 0 ? (
            <div className="space-y-1.5">
              {order.items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-[var(--hover-bg)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.itemType === 'PRODUCT' ? (
                      <Package className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    ) : (
                      <Scissors className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    )}
                    <span className="text-sm text-[var(--text-primary)]">
                      {item.product?.name || item.service?.name || 'Item'}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-xs text-[var(--text-muted)]">x{item.quantity}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    {canEditOrder && (
                      <button onClick={() => handleRemoveItem(item.id)} className="rounded p-1 text-[#A63030] hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {/* Total */}
              <div className="flex items-center justify-between border-t border-[var(--border-color)] px-3 pt-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Total</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-[var(--text-muted)]">Nenhum item na comanda</p>
          )}

          {/* Add item form */}
          {showAddItem && canEditOrder && (
            <div className="mt-3 space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-3">
              <div className="flex gap-2">
                <button onClick={() => { setAddItemType('PRODUCT'); setSelectedItemId(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${addItemType === 'PRODUCT' ? 'bg-[#C8923A]/20 text-[#C8923A]' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}>
                  <Package className="mr-1 inline h-3.5 w-3.5" />Produto
                </button>
                <button onClick={() => { setAddItemType('SERVICE'); setSelectedItemId(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${addItemType === 'SERVICE' ? 'bg-[#C8923A]/20 text-[#C8923A]' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}>
                  <Scissors className="mr-1 inline h-3.5 w-3.5" />Servi\u00e7o
                </button>
              </div>
              <div className="flex gap-2">
                <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]">
                  <option value="">Selecione...</option>
                  {addItemType === 'PRODUCT'
                    ? (products || []).filter((p) => p.isActive).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} - {formatCurrency((p as any).salePrice)}</option>
                      ))
                    : (services || []).filter((s: any) => s.isActive).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.price)}</option>
                      ))
                  }
                </select>
                {addItemType === 'PRODUCT' && (
                  <input type="number" min={1} value={itemQuantity} onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-2 py-2 text-center text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]" />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddItem(false)} className="rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--hover-bg)]">Cancelar</button>
                <button onClick={handleAddItem} disabled={!selectedItemId || addOrderItem.isPending} className="flex items-center gap-1 rounded-lg bg-[#8B6914] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#725510] disabled:opacity-50">
                  {addOrderItem.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notes (view mode) */}
        {!isEditing && appointment.notes && (
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-primary)] p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Observa\u00e7\u00f5es</div>
            <p className="text-sm text-[var(--text-secondary)]">{appointment.notes}</p>
          </div>
        )}

        {/* Actions */}
        {!isEditing && isScheduled && (
          isConfirmingCancel ? (
            <div className="rounded-xl border border-[#A63030]/30 bg-red-500/10 p-4">
              <p className="mb-3 text-sm text-[var(--text-secondary)]">
                Confirmar cancelamento do agendamento de <strong>{appointment.client?.name}</strong>?
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsConfirmingCancel(false)} disabled={isActing} className="rounded-xl border border-[var(--card-border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-50">N\u00e3o</button>
                <button onClick={() => handleAction(() => onCancel(appointment.id))} disabled={isActing} className="flex items-center gap-1.5 rounded-xl bg-[#A63030] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#8B2020] disabled:opacity-50">
                  {isActing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => handleAction(() => onAttend(appointment.id))} disabled={isActing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
                {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Atendido
              </button>
              <button onClick={() => handleAction(() => onNoShow(appointment.id))} disabled={isActing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/25 disabled:opacity-50">
                {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                N\u00e3o Compareceu
              </button>
              <button onClick={() => setIsConfirmingCancel(true)} disabled={isActing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-sm font-medium text-[#C45050] transition-colors hover:bg-red-500/25 disabled:opacity-50">
                <XCircle className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
