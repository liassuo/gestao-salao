import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, AlertCircle, Eye, Trash2, CreditCard, XCircle, ShoppingCart, X, Package, Scissors, Banknote, Smartphone, CircleDollarSign, Tag, Minus } from 'lucide-react';
import { useOrders, useCreateOrder, usePayOrder, useCancelOrder, useDeleteOrder, useAddOrderItem, useRemoveOrderItem, useClients, useProducts, useServices, useActivePromotions, useClientSubscription, useProfessionals, getApiErrorMessage } from '@/hooks';
import { ordersService } from '@/services/orders';
import { Modal, ConfirmModal, useToast } from '@/components/ui';
import type { Order, OrderStatus, CreateOrderPayload, AddOrderItemPayload, OrderItemType } from '@/types';
import { orderStatusLabels, orderStatusColors } from '@/types';
import {
  getActiveSubscriptionView,
  resolveCartLine,
  type ActiveSubscriptionView,
  type ResolvedLine,
} from '@/utils';

type PaymentMethod = 'CASH' | 'PIX' | 'CARD';

// Entrada bruta do carrinho (o que o admin clicou). Os preços e flags de
// consumo de corte são derivados via `resolveCart` — assim o saldo simulado
// é sempre coerente com a ordem dos itens (1º consome 1º crédito, etc).
interface CartEntry {
  id: string; // productId or serviceId
  name: string;
  itemType: OrderItemType;
  originalPrice: number;
  quantity: number;
}

interface ResolvedCartLine extends CartEntry {
  /** Linhas expandidas: cada unidade vira uma sub-linha com seu próprio preço/flag. */
  units: ResolvedLine[];
  /** Soma de todas as unidades. */
  lineTotal: number;
  /** True se ao menos uma unidade consumiu corte. */
  anyConsumesCut: boolean;
  /** True se ao menos uma unidade caiu em fallback por limite mensal. */
  anyLimitReached: boolean;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Resolve o carrinho inteiro contra o saldo da assinatura. Itera item por item,
 * expandindo cada unidade individualmente (uma unidade pode consumir corte e a
 * próxima cair no fallback se o saldo acabar). Retorna também o saldo restante
 * após processar tudo, pra UI mostrar "x cortes consumidos / y cortes restantes".
 */
function resolveCart(
  entries: CartEntry[],
  promotions: ReturnType<typeof useActivePromotions>['data'],
  sub: ActiveSubscriptionView | null,
): { lines: ResolvedCartLine[]; cutsConsumed: number; remainingCutsAfter: number } {
  let remaining = sub?.remainingCuts ?? 0;
  const startingRemaining = remaining;
  const lines: ResolvedCartLine[] = [];

  for (const entry of entries) {
    const units: ResolvedLine[] = [];
    for (let i = 0; i < entry.quantity; i++) {
      const line = resolveCartLine(
        entry.itemType,
        entry.id,
        entry.originalPrice,
        promotions,
        sub,
        remaining,
      );
      if (line.consumesCut) remaining -= 1;
      units.push(line);
    }
    const lineTotal = units.reduce((acc, u) => acc + u.unitPrice, 0);
    lines.push({
      ...entry,
      units,
      lineTotal,
      anyConsumesCut: units.some((u) => u.consumesCut),
      anyLimitReached: units.some((u) => u.planLimitReached),
    });
  }

  const cutsConsumed = Number.isFinite(startingRemaining)
    ? Math.max(0, (startingRemaining as number) - remaining)
    : units_consumed(lines);
  return { lines, cutsConsumed, remainingCutsAfter: remaining };
}

function units_consumed(lines: ResolvedCartLine[]): number {
  let n = 0;
  for (const l of lines) for (const u of l.units) if (u.consumesCut) n += 1;
  return n;
}

export function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setIsCreateModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [payAsDebt, setPayAsDebt] = useState(false);
  const [debtProfessionalId, setDebtProfessionalId] = useState<string>('');

  // Create form state
  const [createClientId, setCreateClientId] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [cartItems, setCartItems] = useState<CartEntry[]>([]);
  const [createItemTab, setCreateItemTab] = useState<OrderItemType>('PRODUCT');
  const [createConsumerType, setCreateConsumerType] = useState<'CLIENT' | 'PROFESSIONAL'>('CLIENT');
  const [createConsumerProfessionalId, setCreateConsumerProfessionalId] = useState('');

  // Add item form state
  const [itemType, setItemType] = useState<OrderItemType>('PRODUCT');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  const { data: orders, isLoading, error } = useOrders(statusFilter ? { status: statusFilter } : undefined);
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: services } = useServices();
  const { data: activePromotions } = useActivePromotions();
  const { data: professionals } = useProfessionals();
  // Quando há cliente selecionado (na criação) ou na comanda em visualização,
  // buscamos a assinatura ativa dele para aplicar o desconto do plano.
  const activeClientId = viewingOrder?.client?.id || createClientId || undefined;
  const { data: clientSub } = useClientSubscription(activeClientId);
  // Visão completa da assinatura ativa: plano + saldo de cortes + label.
  // Null para PENDING_PAYMENT/CANCELED/SUSPENDED — esses estados não concedem desconto.
  const activeSub: ActiveSubscriptionView | null = useMemo(
    () => getActiveSubscriptionView(clientSub),
    [clientSub],
  );
  const planLabel = activeSub?.planLabel ?? 'Assinatura';

  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();
  const cancelOrder = useCancelOrder();
  const deleteOrder = useDeleteOrder();
  const addOrderItem = useAddOrderItem();
  const removeOrderItem = useRemoveOrderItem();
  const toast = useToast();

  // Resolve o carrinho inteiro contra o saldo da assinatura sempre que o cart
  // ou a assinatura mudam — o backend faz a mesma simulação ao persistir.
  const resolvedCart = useMemo(
    () => resolveCart(cartItems, activePromotions, activeSub),
    [cartItems, activePromotions, activeSub],
  );
  const cartTotal = useMemo(
    () => resolvedCart.lines.reduce((acc, line) => acc + line.lineTotal, 0),
    [resolvedCart],
  );

  const addToCart = (id: string, name: string, itemType: OrderItemType, originalPrice: number) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === id && i.itemType === itemType);
      if (existing) {
        return prev.map((i) => i.id === id && i.itemType === itemType ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id, name, itemType, originalPrice, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string, itemType: OrderItemType) => {
    setCartItems((prev) => prev.filter((i) => !(i.id === id && i.itemType === itemType)));
  };

  const updateCartQty = (id: string, itemType: OrderItemType, delta: number) => {
    setCartItems((prev) => prev.map((i) => {
      if (i.id === id && i.itemType === itemType) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const handleCreate = async () => {
    try {
      if (createConsumerType === 'PROFESSIONAL' && !createConsumerProfessionalId) {
        toast.error('Selecione o profissional', 'Informe quem está consumindo a comanda.');
        return;
      }

      const payload: CreateOrderPayload = {};
      if (createConsumerType === 'PROFESSIONAL') {
        payload.consumerType = 'PROFESSIONAL';
        payload.consumerProfessionalId = createConsumerProfessionalId;
      } else if (createClientId) {
        payload.clientId = createClientId;
      }
      if (createNotes.trim()) payload.notes = createNotes.trim();

      if (cartItems.length > 0) {
        // Enviamos o preço cheio como `unitPrice`. O backend ignora quando
        // productId/serviceId estão presentes — recalcula a partir do banco
        // aplicando promoção, override de plano e consumo de cortes. Esse `unitPrice`
        // só é usado como fallback quando o item não tem id (caso raro/livre).
        payload.items = cartItems.map((item) => ({
          productId: item.itemType === 'PRODUCT' ? item.id : undefined,
          serviceId: item.itemType === 'SERVICE' ? item.id : undefined,
          quantity: item.quantity,
          unitPrice: item.originalPrice,
          itemType: item.itemType,
        }));
      }

      await createOrder.mutateAsync(payload);
      toast.success('Comanda criada com sucesso');
      setIsCreateModalOpen(false);
      setCreateClientId('');
      setCreateNotes('');
      setCartItems([]);
      setCreateItemTab('PRODUCT');
      setCreateConsumerType('CLIENT');
      setCreateConsumerProfessionalId('');
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const openPayModal = (id: string) => {
    setPaymentMethod('CASH');
    setPayAsDebt(false);
    setDebtProfessionalId('');
    setPayingOrderId(id);
  };

  const [useAsaas, setUseAsaas] = useState(false);

  const handleConfirmPay = async () => {
    if (!payingOrderId) return;
    try {
      if (payAsDebt) {
        if (!debtProfessionalId) {
          toast.error('Selecione o profissional', 'Informe quem está consumindo a comanda.');
          return;
        }
        await payOrder.mutateAsync({
          id: payingOrderId,
          asProfessionalDebt: true,
          consumerProfessionalId: debtProfessionalId,
        });
        toast.success(
          'Comanda lançada como débito',
          'Será descontada da próxima comissão deste profissional.',
        );
        setPayingOrderId(null);
        setViewingOrder(null);
        setPayAsDebt(false);
        setDebtProfessionalId('');
        return;
      }

      const data: { paymentMethod?: PaymentMethod; billingType?: string } = { paymentMethod };
      if (useAsaas && (paymentMethod === 'PIX' || paymentMethod === 'CARD')) {
        data.billingType = paymentMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD';
      }

      const res = (await payOrder.mutateAsync({ id: payingOrderId, ...data })) as any;

      if (res.asaasCharge?.invoiceUrl) {
        window.location.href = res.asaasCharge.invoiceUrl;
        toast.success('Cobrança Asaas gerada. Redirecionando para pagamento.');
      } else {
        toast.success('Comanda marcada como paga');
      }

      setPayingOrderId(null);
      setViewingOrder(null);
      setUseAsaas(false);
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

  const handleAddItem = async () => {
    if (!viewingOrder) return;
    try {
      let payload: AddOrderItemPayload;
      // Enviamos o preço cheio. Backend recalcula aplicando promoção, override de
      // plano e consumo de cortes — UI mostra apenas a previsão.
      if (itemType === 'PRODUCT') {
        const product = products?.find((p) => p.id === selectedProductId);
        if (!product) return;
        payload = {
          productId: product.id,
          quantity: itemQuantity,
          unitPrice: product.salePrice,
          itemType: 'PRODUCT',
        };
      } else {
        const service = services?.find((s) => s.id === selectedServiceId);
        if (!service) return;
        payload = {
          serviceId: service.id,
          quantity: itemQuantity,
          unitPrice: service.price,
          itemType: 'SERVICE',
        };
      }
      const updated = await addOrderItem.mutateAsync({ orderId: viewingOrder.id, payload });
      toast.success('Item adicionado');
      setViewingOrder(updated);
      setIsAddItemOpen(false);
      resetAddItemForm();
    } catch (err) { toast.error('Erro', getApiErrorMessage(err)); }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!viewingOrder) return;
    try {
      await removeOrderItem.mutateAsync({ orderId: viewingOrder.id, itemId });
      toast.success('Item removido');
      // Update the viewing order locally
      setViewingOrder((prev) => prev ? {
        ...prev,
        items: (prev.items || []).filter((i) => i.id !== itemId),
        totalAmount: prev.totalAmount - ((prev.items || []).find((i) => i.id === itemId)?.unitPrice ?? 0) * ((prev.items || []).find((i) => i.id === itemId)?.quantity ?? 1),
      } : null);
    } catch (err) { toast.error('Erro', getApiErrorMessage(err)); }
  };

  const resetAddItemForm = () => {
    setItemType('PRODUCT');
    setSelectedProductId('');
    setSelectedServiceId('');
    setItemQuantity(1);
  };

  const selectedProduct = products?.find((p) => p.id === selectedProductId);
  const selectedService = services?.find((s) => s.id === selectedServiceId);
  // Preview espelha o que o backend vai cobrar: aplica promoção, override do plano
  // e consumo de cortes. Para "Adicionar Item" em comanda existente, o saldo de
  // partida é o saldo ATUAL da assinatura (a comanda em vigor já consumiu o que
  // tinha que consumir; itens novos partem desse ponto).
  const previewBasePrice = itemType === 'PRODUCT'
    ? (selectedProduct?.salePrice ?? 0)
    : (selectedService?.price ?? 0);
  const previewItemId = itemType === 'PRODUCT' ? selectedProductId : selectedServiceId;

  // Resolve cada uma das `itemQuantity` unidades contra o saldo atual da assinatura.
  const previewUnits: ResolvedLine[] = useMemo(() => {
    if (!previewItemId) return [];
    let remaining = activeSub?.remainingCuts ?? 0;
    const out: ResolvedLine[] = [];
    for (let i = 0; i < itemQuantity; i++) {
      const line = resolveCartLine(
        itemType,
        previewItemId,
        previewBasePrice,
        activePromotions,
        activeSub,
        remaining,
      );
      if (line.consumesCut) remaining -= 1;
      out.push(line);
    }
    return out;
  }, [previewItemId, itemType, previewBasePrice, itemQuantity, activePromotions, activeSub]);

  const itemPreviewPrice = previewUnits.reduce((acc, u) => acc + u.unitPrice, 0);
  const itemPreviewOriginal = previewBasePrice * itemQuantity;
  const previewAnyConsumesCut = previewUnits.some((u) => u.consumesCut);
  const previewAnyLimitReached = previewUnits.some((u) => u.planLimitReached);
  // Para mostrar o "rótulo" do desconto resumido, usa o do primeiro unit com desconto.
  const previewDiscountLabel = previewUnits.find((u) => u.discount)?.discount ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B6914]"><ClipboardList className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Comandas</h1>
            <p className="text-sm text-[var(--text-muted)]">Gerenciamento de comandas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')} className="rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[#C8923A] focus:outline-none">
            <option value="">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
            <option value="PAID_AS_DEBT">Lançado como débito</option>
            <option value="CANCELED">Cancelado</option>
          </select>
          <button onClick={() => { setCreateClientId(''); setCreateNotes(''); setCartItems([]); setCreateItemTab('PRODUCT'); setIsCreateModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510]">
            <Plus className="h-4 w-4" /> Nova Comanda
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8923A] border-t-transparent" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-[#C45050]"><AlertCircle className="h-5 w-5" /><span>Erro ao carregar comandas</span></div>
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
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {order.consumerType === 'PROFESSIONAL' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-300">
                          {order.consumerProfessional?.name || order.professional?.name || 'Profissional'} (débito)
                        </span>
                      ) : (
                        order.client?.name || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{order.items?.length ?? '-'}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{formatCents(order.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${orderStatusColors[order.status]}`}>{orderStatusLabels[order.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(order.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={async () => { try { const full = await ordersService.getById(order.id); setViewingOrder(full); } catch { setViewingOrder({ ...order, items: [] }); } }} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[#D4A85C]"><Eye className="h-4 w-4" /></button>
                        {order.status === 'PENDING' && (
                          <>
                            <button onClick={() => openPayModal(order.id)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-green-400"><CreditCard className="h-4 w-4" /></button>
                            <button onClick={() => handleCancel(order.id)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-yellow-400"><XCircle className="h-4 w-4" /></button>
                          </>
                        )}
                        {order.status === 'PAID_AS_DEBT' && (
                          <button onClick={() => handleCancel(order.id)} title="Cancelar (estorna estoque e anula débito)" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-yellow-400"><XCircle className="h-4 w-4" /></button>
                        )}
                        <button onClick={() => setDeletingOrder(order)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[#C45050]"><Trash2 className="h-4 w-4" /></button>
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
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Nova Comanda" size="lg">
        <div className="space-y-4">
          {/* Toggle: cliente vs profissional consumindo */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Para quem é a comanda?</label>
            <div className="flex gap-2 rounded-lg bg-[var(--hover-bg)] p-1">
              <button
                onClick={() => setCreateConsumerType('CLIENT')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  createConsumerType === 'CLIENT'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                Cliente
              </button>
              <button
                onClick={() => setCreateConsumerType('PROFESSIONAL')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  createConsumerType === 'PROFESSIONAL'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                Profissional (vira débito)
              </button>
            </div>
          </div>

          {createConsumerType === 'CLIENT' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Cliente (opcional)</label>
              <select
                value={createClientId}
                onChange={(e) => setCreateClientId(e.target.value)}
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[#C8923A] focus:outline-none"
              >
                <option value="">Sem cliente</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Profissional consumidor *</label>
              <select
                value={createConsumerProfessionalId}
                onChange={(e) => setCreateConsumerProfessionalId(e.target.value)}
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">Selecione o profissional</option>
                {(professionals || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                Esta comanda será lançada como débito do profissional ao ser fechada — não entra no
                caixa, é descontada da próxima comissão dele.
              </p>
            </div>
          )}

          {/* Adicionar itens */}
          <div className="border-t border-[var(--card-border)] pt-4">
            <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Itens da Comanda</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setCreateItemTab('PRODUCT')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${createItemTab === 'PRODUCT' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
              >
                <Package className="h-4 w-4" /> Produtos
              </button>
              <button
                onClick={() => setCreateItemTab('SERVICE')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${createItemTab === 'SERVICE' ? 'border-[#C8923A] bg-[#C8923A]/20 text-[#D4A85C]' : 'border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
              >
                <Scissors className="h-4 w-4" /> Serviços
              </button>
            </div>

            {/* Lista de produtos/serviços para adicionar */}
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] divide-y divide-[var(--card-border)]">
              {createItemTab === 'PRODUCT' ? (
                products?.filter((p) => p.isActive !== false).length ? (
                  products.filter((p) => p.isActive !== false).map((p) => {
                    // Preview "se adicionar +1": parte do saldo APÓS o cart atual.
                    const line = resolveCartLine(
                      'PRODUCT',
                      p.id,
                      p.salePrice,
                      activePromotions,
                      activeSub,
                      resolvedCart.remainingCutsAfter,
                    );
                    const inCart = cartItems.find((i) => i.id === p.id && i.itemType === 'PRODUCT');
                    return (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p.id, p.name, 'PRODUCT', p.salePrice)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--card-bg)] ${inCart ? 'bg-[var(--card-bg)]' : ''}`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                          <span className="truncate text-[var(--text-primary)]">{p.name}</span>
                          {inCart && <span className="shrink-0 text-xs text-[#C8923A] font-medium">x{inCart.quantity}</span>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {line.discount ? (
                            <>
                              <span className="hidden sm:flex items-center gap-1 text-xs text-green-400">
                                <Tag className="h-3 w-3" />-{line.discount.percent}%
                              </span>
                              <span className="hidden md:inline text-xs text-[var(--text-muted)] line-through">{formatCents(p.salePrice)}</span>
                              <span className="font-medium text-green-400">{formatCents(line.unitPrice)}</span>
                            </>
                          ) : (
                            <span className="text-[var(--text-muted)]">{formatCents(p.salePrice)}</span>
                          )}
                          <Plus className="h-4 w-4 text-[#C8923A]" />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">Nenhum produto</p>
                )
              ) : (
                services?.filter((s) => s.isActive !== false).length ? (
                  services.filter((s) => s.isActive !== false).map((s) => {
                    // Preview "se adicionar +1": parte do saldo APÓS o cart atual.
                    const line = resolveCartLine(
                      'SERVICE',
                      s.id,
                      s.price,
                      activePromotions,
                      activeSub,
                      resolvedCart.remainingCutsAfter,
                    );
                    const inCart = cartItems.find((i) => i.id === s.id && i.itemType === 'SERVICE');
                    return (
                      <button
                        key={s.id}
                        onClick={() => addToCart(s.id, s.name, 'SERVICE', s.price)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--card-bg)] ${inCart ? 'bg-[var(--card-bg)]' : ''}`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Scissors className="h-3.5 w-3.5 text-[#D4A85C] flex-shrink-0" />
                          <span className="truncate text-[var(--text-primary)]">{s.name}</span>
                          {inCart && <span className="shrink-0 text-xs text-[#C8923A] font-medium">x{inCart.quantity}</span>}
                          {line.consumesCut && (
                            <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                              incluso no plano
                            </span>
                          )}
                          {line.planLimitReached && (
                            <span className="shrink-0 rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                              limite atingido
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {line.discount ? (
                            <>
                              <span className="hidden sm:flex items-center gap-1 text-xs text-green-400">
                                <Tag className="h-3 w-3" />-{line.discount.percent}%
                              </span>
                              <span className="hidden md:inline text-xs text-[var(--text-muted)] line-through">{formatCents(s.price)}</span>
                              <span className="font-medium text-green-400">{formatCents(line.unitPrice)}</span>
                            </>
                          ) : (
                            <span className="text-[var(--text-muted)]">{formatCents(s.price)}</span>
                          )}
                          <Plus className="h-4 w-4 text-[#C8923A]" />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-4 text-center text-sm text-[var(--text-muted)]">Nenhum serviço</p>
                )
              )}
            </div>
          </div>

          {/* Banner do plano: mostra saldo de cortes pra dar contexto ao admin */}
          {activeSub && createConsumerType === 'CLIENT' && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-emerald-300">{activeSub.planLabel}</span>
                <span className="text-emerald-200">
                  {activeSub.remainingCuts === Number.POSITIVE_INFINITY
                    ? 'Cortes ilimitados'
                    : `${Math.max(0, activeSub.remainingCuts - resolvedCart.cutsConsumed)} de ${activeSub.cutsPerMonth} cortes restantes este mês`}
                  {resolvedCart.cutsConsumed > 0 && (
                    <span className="ml-1 text-emerald-400">
                      (–{resolvedCart.cutsConsumed} ao salvar)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Carrinho */}
          {resolvedCart.lines.length > 0 && (
            <div className="border-t border-[var(--card-border)] pt-4">
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Itens selecionados ({resolvedCart.lines.length})</label>
              <div className="space-y-2">
                {resolvedCart.lines.map((line) => (
                  <div key={`${line.itemType}-${line.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {line.itemType === 'PRODUCT' ? <Package className="h-4 w-4 shrink-0 text-purple-400" /> : <Scissors className="h-4 w-4 shrink-0 text-[#D4A85C]" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{line.name}</p>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          {line.anyConsumesCut && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                              <Tag className="h-2.5 w-2.5" /> incluso no plano
                            </span>
                          )}
                          {line.anyLimitReached && (
                            <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                              <AlertCircle className="h-2.5 w-2.5" /> limite mensal atingido — cobra
                            </span>
                          )}
                          {line.units.length > 1 ? (
                            <span className="text-xs text-[var(--text-muted)]">
                              {line.units.map((u) => formatCents(u.unitPrice)).join(' + ')}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">
                              {formatCents(line.units[0]?.unitPrice ?? 0)} un.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
                        <button onClick={() => updateCartQty(line.id, line.itemType, -1)} className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Minus className="h-3 w-3" /></button>
                        <span className="text-sm font-medium text-[var(--text-primary)] min-w-[20px] text-center">{line.quantity}</span>
                        <button onClick={() => updateCartQty(line.id, line.itemType, 1)} className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="hidden sm:inline text-sm font-medium text-[var(--text-primary)] min-w-[70px] text-right">{formatCents(line.lineTotal)}</span>
                      <button onClick={() => removeFromCart(line.id, line.itemType)} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-red-500/20 hover:text-[#C45050]"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between rounded-xl bg-[#C8923A]/10 px-3 py-2">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Total</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{formatCents(cartTotal)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Observações (opcional)</label>
            <textarea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              rows={2}
              placeholder="Observações sobre a comanda..."
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[#C8923A] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setIsCreateModalOpen(false)} className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">Cancelar</button>
            <button onClick={handleCreate} disabled={createOrder.isPending} className="rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50">
              {createOrder.isPending ? 'Criando...' : 'Criar Comanda'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View/Detail Modal - with add/remove items */}
      <Modal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} title="Detalhes da Comanda" size="lg">
        {viewingOrder && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-[var(--text-muted)]">Cliente:</span><p className="font-medium text-[var(--text-primary)]">{viewingOrder.client?.name || '-'}</p></div>
              <div><span className="text-[var(--text-muted)]">Status:</span><p><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${orderStatusColors[viewingOrder.status]}`}>{orderStatusLabels[viewingOrder.status]}</span></p></div>
              <div><span className="text-[var(--text-muted)]">Total:</span><p className="text-lg font-bold text-[var(--text-primary)]">{formatCents(viewingOrder.totalAmount)}</p></div>
              <div><span className="text-[var(--text-muted)]">Criado em:</span><p className="text-[var(--text-primary)]">{new Date(viewingOrder.createdAt).toLocaleString('pt-BR')}</p></div>
            </div>

            {/* Items section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-[var(--text-primary)]">Itens ({viewingOrder.items?.length ?? 0})</h4>
                {viewingOrder.status === 'PENDING' && (
                  <button
                    onClick={() => { resetAddItemForm(); setIsAddItemOpen(true); }}
                    className="flex items-center gap-1.5 rounded-lg bg-[#8B6914] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#725510]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Item
                  </button>
                )}
              </div>

              {!viewingOrder.items || viewingOrder.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
                  <ShoppingCart className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum item na comanda</p>
                  {viewingOrder.status === 'PENDING' && (
                    <p className="text-xs mt-1">Clique em "Adicionar Item" para começar</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {viewingOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-[var(--card-border)] p-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.itemType === 'PRODUCT' ? 'bg-purple-500/20 text-purple-400' : 'bg-[#C8923A]/20 text-[#D4A85C]'}`}>
                          {item.itemType === 'PRODUCT' ? <Package className="h-4 w-4" /> : <Scissors className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{item.product?.name || item.service?.name || '-'}</p>
                          <p className="text-xs text-[var(--text-muted)]">{item.itemType === 'PRODUCT' ? 'Produto' : 'Serviço'} &middot; {item.quantity}x {formatCents(item.unitPrice)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[var(--text-primary)]">{formatCents(item.unitPrice * item.quantity)}</p>
                        {viewingOrder.status === 'PENDING' && (
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-red-500/20 hover:text-[#C45050]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {viewingOrder.status === 'PENDING' && (
              <div className="flex justify-end gap-3 border-t border-[var(--card-border)] pt-4">
                <button
                  onClick={() => handleCancel(viewingOrder.id)}
                  className="flex items-center gap-2 rounded-xl border border-yellow-500/50 px-4 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/10"
                >
                  <XCircle className="h-4 w-4" /> Cancelar
                </button>
                <button
                  onClick={() => openPayModal(viewingOrder.id)}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <CreditCard className="h-4 w-4" /> Pagar
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Item Modal */}
      <Modal isOpen={isAddItemOpen} onClose={() => setIsAddItemOpen(false)} title="Adicionar Item">
        <div className="space-y-4">
          {/* Item type toggle */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Tipo</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setItemType('PRODUCT'); setSelectedServiceId(''); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${itemType === 'PRODUCT' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
              >
                <Package className="h-4 w-4" /> Produto
              </button>
              <button
                onClick={() => { setItemType('SERVICE'); setSelectedProductId(''); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${itemType === 'SERVICE' ? 'border-[#C8923A] bg-[#C8923A]/20 text-[#D4A85C]' : 'border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
              >
                <Scissors className="h-4 w-4" /> Serviço
              </button>
            </div>
          </div>

          {/* Product/Service selector */}
          {itemType === 'PRODUCT' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Produto</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[#C8923A] focus:outline-none"
              >
                <option value="">Selecione um produto</option>
                {products?.filter((p) => p.isActive !== false).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} - {formatCents(p.salePrice)}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Serviço</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[#C8923A] focus:outline-none"
              >
                <option value="">Selecione um serviço</option>
                {services?.filter((s) => s.isActive !== false).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} - {formatCents(s.price)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Quantidade</label>
            <input
              type="number"
              min={1}
              value={itemQuantity}
              onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[#C8923A] focus:outline-none"
            />
          </div>

          {/* Preview */}
          {(selectedProductId || selectedServiceId) && (
            <div className="space-y-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] p-3 text-sm">
              {previewAnyConsumesCut && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Tag className="h-3 w-3" />
                  Incluso no plano — consome {previewUnits.filter((u) => u.consumesCut).length} corte(s)
                </div>
              )}
              {previewAnyLimitReached && (
                <div className="flex items-center gap-1.5 text-xs text-orange-400">
                  <AlertCircle className="h-3 w-3" />
                  Limite mensal do plano atingido — será cobrado naturalmente
                </div>
              )}
              {previewDiscountLabel && !previewAnyConsumesCut && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-green-400">
                    <Tag className="h-3 w-3" />
                    {previewDiscountLabel.name} (-{previewDiscountLabel.percent}%)
                  </span>
                  <span className="text-[var(--text-muted)] line-through">
                    {formatCents(itemPreviewOriginal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Subtotal:</span>
                <span
                  className={`font-bold ${
                    itemPreviewPrice < itemPreviewOriginal
                      ? 'text-green-400'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  {formatCents(itemPreviewPrice)}
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setIsAddItemOpen(false)} className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">Cancelar</button>
            <button
              onClick={handleAddItem}
              disabled={addOrderItem.isPending || (itemType === 'PRODUCT' ? !selectedProductId : !selectedServiceId)}
              className="rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50"
            >
              {addOrderItem.isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Method Modal */}
      <Modal isOpen={!!payingOrderId} onClose={() => setPayingOrderId(null)} title="Forma de Pagamento" size="sm">
        <div className="space-y-4">
          {/* Toggle: pagamento normal vs débito do profissional */}
          <div className="flex gap-2 rounded-lg bg-[var(--hover-bg)] p-1">
            <button
              onClick={() => setPayAsDebt(false)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                !payAsDebt
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Cliente paga
            </button>
            <button
              onClick={() => setPayAsDebt(true)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                payAsDebt
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Débito do profissional
            </button>
          </div>

          {payAsDebt ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                A comanda será lançada como débito do profissional consumidor — não entra no caixa
                e o valor será descontado automaticamente da próxima comissão dele.
              </p>
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">
                  Profissional consumidor *
                </label>
                <select
                  value={debtProfessionalId}
                  onChange={(e) => setDebtProfessionalId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Selecione</option>
                  {(professionals || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setPayingOrderId(null)}
                  className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmPay}
                  disabled={payOrder.isPending || !debtProfessionalId}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {payOrder.isPending ? 'Lançando...' : 'Lançar como débito'}
                </button>
              </div>
            </div>
          ) : (
          <>
          <p className="text-sm text-[var(--text-muted)]">Selecione a forma de pagamento para registrar no caixa:</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => { setPaymentMethod('CASH'); setUseAsaas(false); }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${paymentMethod === 'CASH' ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
            >
              <Banknote className="h-6 w-6" />
              <span className="text-xs font-medium">Dinheiro</span>
            </button>
            <button
              onClick={() => { setPaymentMethod('PIX'); setUseAsaas(true); }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${paymentMethod === 'PIX' ? 'border-[#C8923A] bg-[#C8923A]/20 text-[#D4A85C]' : 'border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
            >
              <Smartphone className="h-6 w-6" />
              <span className="text-xs font-medium">PIX (Asaas)</span>
            </button>
            <button
              onClick={() => { setPaymentMethod('CARD'); setUseAsaas(true); }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${paymentMethod === 'CARD' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-[var(--card-border)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
            >
              <CircleDollarSign className="h-6 w-6" />
              <span className="text-xs font-medium">Cartão (Asaas)</span>
            </button>
          </div>

          {(paymentMethod === 'PIX' || paymentMethod === 'CARD') && (
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="useAsaas"
                checked={useAsaas}
                onChange={(e) => setUseAsaas(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--card-border)] bg-[var(--hover-bg)] text-[#C8923A] focus:ring-[#C8923A]"
              />
              <label htmlFor="useAsaas" className="text-xs text-[var(--text-secondary)]">Usar cobrança digital Asaas (link externo)</label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setPayingOrderId(null)} className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">Cancelar</button>
            <button
              onClick={handleConfirmPay}
              disabled={payOrder.isPending}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" /> {payOrder.isPending ? 'Processando...' : 'Confirmar Pagamento'}
            </button>
          </div>
          </>
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      {deletingOrder && (
        <ConfirmModal isOpen={!!deletingOrder} onClose={() => setDeletingOrder(null)} onConfirm={handleDelete} isLoading={deleteOrder.isPending} title="Excluir Comanda" message="Tem certeza que deseja excluir esta comanda?" />
      )}
    </div>
  );
}
