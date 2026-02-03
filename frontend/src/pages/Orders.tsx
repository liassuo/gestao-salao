import { useState } from 'react';
import { ClipboardList, Plus, AlertCircle, Eye, Trash2, CreditCard, XCircle } from 'lucide-react';
import { useOrders, useCreateOrder, usePayOrder, useCancelOrder, useDeleteOrder, getApiErrorMessage } from '@/hooks';
import { Modal, ConfirmModal, useToast } from '@/components/ui';
import type { Order, OrderStatus } from '@/types';
import { orderStatusLabels, orderStatusColors } from '@/types';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Orders() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  const { data: orders, isLoading, error } = useOrders(statusFilter ? { status: statusFilter } : undefined);
  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();
  const cancelOrder = useCancelOrder();
  const deleteOrder = useDeleteOrder();
  const toast = useToast();

  const handleCreate = async () => {
    try {
      await createOrder.mutateAsync({});
      toast.success('Comanda criada com sucesso');
      setIsCreateModalOpen(false);
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const handlePay = async (id: string) => {
    try {
      await payOrder.mutateAsync(id);
      toast.success('Comanda marcada como paga');
      setViewingOrder(null);
    } catch (err) { toast.error('Erro', getApiErrorMessage(err)); }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelOrder.mutateAsync(id);
      toast.success('Comanda cancelada');
      setViewingOrder(null);
    } catch (err) { toast.error('Erro', getApiErrorMessage(err)); }
  };

  const handleDelete = async () => {
    if (!deletingOrder) return;
    try {
      await deleteOrder.mutateAsync(deletingOrder.id);
      toast.success('Comanda excluída');
      setDeletingOrder(null);
    } catch (err) { toast.error('Erro', getApiErrorMessage(err)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><ClipboardList className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Comandas</h1>
            <p className="text-sm text-[var(--text-muted)]">Gerenciamento de comandas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')} className="rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
            <option value="CANCELED">Cancelado</option>
          </select>
          <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nova Comanda
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400"><AlertCircle className="h-5 w-5" /><span>Erro ao carregar comandas</span></div>
        ) : !orders?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <ClipboardList className="h-12 w-12 mb-3 opacity-50" /><p>Nenhuma comanda encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Itens</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Criado em</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-muted)]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-[var(--card-border)] transition-colors hover:bg-[var(--hover-bg)]">
                    <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-sm">{order.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{order.client?.name || '-'}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{order.items.length}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{formatCents(order.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${orderStatusColors[order.status]}`}>{orderStatusLabels[order.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(order.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewingOrder(order)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-blue-400"><Eye className="h-4 w-4" /></button>
                        {order.status === 'PENDING' && (
                          <>
                            <button onClick={() => handlePay(order.id)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-green-400"><CreditCard className="h-4 w-4" /></button>
                            <button onClick={() => handleCancel(order.id)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-yellow-400"><XCircle className="h-4 w-4" /></button>
                          </>
                        )}
                        <button onClick={() => setDeletingOrder(order)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Nova Comanda">
        <div className="space-y-4">
          <p className="text-[var(--text-muted)]">Criar uma nova comanda vazia? Você poderá adicionar itens depois.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setIsCreateModalOpen(false)} className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">Cancelar</button>
            <button onClick={handleCreate} disabled={createOrder.isPending} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{createOrder.isPending ? 'Criando...' : 'Criar Comanda'}</button>
          </div>
        </div>
      </Modal>

      {/* View/Detail Modal */}
      <Modal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} title="Detalhes da Comanda">
        {viewingOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-[var(--text-muted)]">Cliente:</span><p className="font-medium text-[var(--text-primary)]">{viewingOrder.client?.name || '-'}</p></div>
              <div><span className="text-[var(--text-muted)]">Status:</span><p><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${orderStatusColors[viewingOrder.status]}`}>{orderStatusLabels[viewingOrder.status]}</span></p></div>
              <div><span className="text-[var(--text-muted)]">Total:</span><p className="font-medium text-[var(--text-primary)]">{formatCents(viewingOrder.totalAmount)}</p></div>
              <div><span className="text-[var(--text-muted)]">Criado em:</span><p className="text-[var(--text-primary)]">{new Date(viewingOrder.createdAt).toLocaleString('pt-BR')}</p></div>
            </div>
            {viewingOrder.items.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium text-[var(--text-primary)]">Itens</h4>
                <div className="space-y-2">
                  {viewingOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-[var(--card-border)] p-3">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{item.product?.name || item.service?.name || '-'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.itemType === 'PRODUCT' ? 'Produto' : 'Serviço'} x{item.quantity}</p>
                      </div>
                      <p className="font-medium text-[var(--text-primary)]">{formatCents(item.unitPrice * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      {deletingOrder && (
        <ConfirmModal isOpen={!!deletingOrder} onClose={() => setDeletingOrder(null)} onConfirm={handleDelete} isLoading={deleteOrder.isPending} title="Excluir Comanda" message={`Tem certeza que deseja excluir esta comanda?`} />
      )}
    </div>
  );
}
