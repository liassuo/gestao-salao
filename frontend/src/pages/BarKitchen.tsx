import { UtensilsCrossed, CheckCircle, Clock } from 'lucide-react';
import { usePendingOrders, usePayOrder, getApiErrorMessage } from '@/hooks';
import { useToast } from '@/components/ui';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function BarKitchen() {
  const { data: orders, isLoading } = usePendingOrders();
  const payOrder = usePayOrder();
  const toast = useToast();

  const handleDeliver = async (id: string) => {
    try {
      await payOrder.mutateAsync({ id });
      toast.success('Pedido entregue!');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600"><UtensilsCrossed className="h-5 w-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Bar / Cozinha</h1>
          <p className="text-sm text-[var(--text-muted)]">Pedidos pendentes para entrega</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" /></div>
      ) : !orders?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <CheckCircle className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-xl font-medium">Nenhum pedido pendente</p>
          <p className="text-sm">Todos os pedidos foram entregues</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-sm text-[var(--text-muted)]">#{order.id.slice(0, 8)}</span>
                <div className="flex items-center gap-1 text-yellow-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">{new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              {order.client && <p className="font-medium text-[var(--text-primary)] mb-3">{order.client.name}</p>}
              <div className="space-y-2 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{item.quantity}x {item.product?.name || item.service?.name}</span>
                    <span className="text-[var(--text-muted)]">{formatCents(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-[var(--card-border)] pt-3">
                <span className="font-bold text-[var(--text-primary)]">{formatCents(order.totalAmount)}</span>
                <button onClick={() => handleDeliver(order.id)} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                  <CheckCircle className="h-4 w-4" /> Entregar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
