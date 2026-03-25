import { useState, useMemo } from 'react';
import { ClipboardList, Plus, AlertCircle, Eye, Trash2, CreditCard, XCircle, ShoppingCart, X, Package, Scissors, Banknote, Smartphone, CircleDollarSign, Tag, Minus } from 'lucide-react';
import { useOrders, useCreateOrder, usePayOrder, useCancelOrder, useDeleteOrder, useAddOrderItem, useRemoveOrderItem, useClients, useProducts, useServices, useActivePromotions, getApiErrorMessage } from '@/hooks';
import { ordersService } from '@/services/orders';
import { Modal, ConfirmModal, useToast } from '@/components/ui';
import type { Order, OrderStatus, CreateOrderPayload, AddOrderItemPayload, OrderItemType, Promotion } from '@/types';
import { orderStatusLabels, orderStatusColors } from '@/types';

type PaymentMethod = 'CASH' | 'PIX' | 'CARD';

interface CartItem {
  id: string; // productId or serviceId
  name: string;
  itemType: OrderItemType;
  originalPrice: number;
  unitPrice: number;
  quantity: number;
  hasPromo: boolean;
  promoName?: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getProductDiscount(productId: string, promotions: Promotion[]): { percent: number; name: string } | null {
  for (const promo of promotions) {
    if (promo.products?.some((p) => p.id === productId)) {
      return { percent: promo.discountPercent, name: promo.name };
    }
  }
  return null;
}

function getServiceDiscount(serviceId: string, promotions: Promotion[]): { percent: number; name: string } | null {
  for (const promo of promotions) {
    if (promo.services?.some((s) => s.id === serviceId)) {
      return { percent: promo.discountPercent, name: promo.name };
    }
  }
  return null;
}

function applyDiscount(price: number, percent: number): number {
  return Math.round(price * (100 - percent) / 100);
}

export function Orders() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  // Create form state
  const [createClientId, setCreateClientId] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [createItemTab, setCreateItemTab] = useState<OrderItemType>('PRODUCT');

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
  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();
  const cancelOrder = useCancelOrder();
  const deleteOrder = useDeleteOrder();
  const addOrderItem = useAddOrderItem();
  const removeOrderItem = useRemoveOrderItem();
  const toast = useToast();

  const cartTotal = useMemo(() => cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0), [cartItems]);

  const addToCart = (id: string, name: string, itemType: OrderItemType, originalPrice: number) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === id && i.itemType === itemType);
      if (existing) {
        return prev.map((i) => i.id === id && i.itemType === itemType ? { ...i, quantity: i.quantity + 1 } : i);
      }
      const promos = activePromotions || [];
      const discount = itemType === 'PRODUCT' ? getProductDiscount(id, promos) : getServiceDiscount(id, promos);
      const unitPrice = discount ? applyDiscount(originalPrice, discount.percent) : originalPrice;
      return [...prev, { id, name, itemType, originalPrice, unitPrice, quantity: 1, hasPromo: !!discount, promoName: discount?.name }];
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
      const payload: CreateOrderPayload = {};
      if (createClientId) payload.clientId = createClientId;
      if (createNotes.trim()) payload.notes = createNotes.trim();

      if (cartItems.length > 0) {
        payload.items = cartItems.map((item) => ({
          productId: item.itemType === 'PRODUCT' ? item.id : undefined,
          serviceId: item.itemType === 'SERVICE' ? item.id : undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
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
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  const openPayModal = (id: string) => {
    setPaymentMethod('CASH');
    setPayingOrderId(id);
  };

  const [useAsaas, setUseAsaas] = useState(false);

  const handleConfirmPay = async () => {
    if (!payingOrderId) return;
    try {
      const data: { paymentMethod?: PaymentMethod; billingType?: string } = { paymentMethod };
      if (useAsaas && (paymentMethod === 'PIX' || paymentMethod === 'CARD')) {
        data.billingType = paymentMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD';
      }

      const res = (await payOrder.mutateAsync({ id: payingOrderId, ...data })) as any;
      
      if (res.asaasCharge?.invoiceUrl) {
        window.open(res.asaasCharge.invoiceUrl, '_blank');
        toast.success('Cobrança Asaas gerada. Link aberto em nova aba.');
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
      const promos = activePromotions || [];
      if (itemType === 'PRODUCT') {
        const product = products?.find((p) => p.id === selectedProductId);
        if (!product) return;
        const discount = getProductDiscount(product.id, promos);
        const price = discount ? applyDiscount(product.salePrice, discount.percent) : product.salePrice;
        payload = { productId: product.id, quantity: itemQuantity, unitPrice: price, itemType: 'PRODUCT' };
      } else {
        const service = services?.find((s) => s.id === selectedServiceId);
        if (!service) return;
        const discount = getServiceDiscount(service.id, promos);
        const price = discount ? applyDiscount(service.price, discount.percent) : service.price;
        payload = { serviceId: service.id, quantity: itemQuantity, unitPrice: price, itemType: 'SERVICE' };
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
  const itemPreviewPrice = itemType === 'PRODUCT'
    ? (selectedProduct?.salePrice ?? 0) * itemQuantity
    : (selectedService?.price ?? 0) * itemQuantity;

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
                    <td className="px-4 py-3 text-[var(--text-primary)]">{order.client?.name || '-'}</td>
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
                    const discount = getProductDiscount(p.id, activePromotions || []);
                    const finalPrice = discount ? applyDiscount(p.salePrice, discount.percent) : p.salePrice;
                    const inCart = cartItems.find((i) => i.id === p.id && i.itemType === 'PRODUCT');
                    return (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p.id, p.name, 'PRODUCT', p.salePrice)}
                        className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-[var(--card-bg)] ${inCart ? 'bg-[var(--card-bg)]' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                          <span className="text-[var(--text-primary)]">{p.name}</span>
                          {inCart && <span className="text-xs text-[#C8923A] font-medium">x{inCart.quantity}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {discount ? (
                            <>
                              <span className="flex items-center gap-1 text-xs text-green-400">
                                <Tag className="h-3 w-3" />-{discount.percent}%
                              </span>
                              <span className="text-xs text-[var(--text-muted)] line-through">{formatCents(p.salePrice)}</span>
                              <span className="font-medium text-green-400">{formatCents(finalPrice)}</span>
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
                    const discount = getServiceDiscount(s.id, activePromotions || []);
                    const finalPrice = discount ? applyDiscount(s.price, discount.percent) : s.price;
                    const inCart = cartItems.find((i) => i.id === s.id && i.itemType === 'SERVICE');
                    return (
                      <button
                        key={s.id}
                        onClick={() => addToCart(s.id, s.name, 'SERVICE', s.price)}
                        className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-[var(--card-bg)] ${inCart ? 'bg-[var(--card-bg)]' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <Scissors className="h-3.5 w-3.5 text-[#D4A85C] flex-shrink-0" />
                          <span className="text-[var(--text-primary)]">{s.name}</span>
                          {inCart && <span className="text-xs text-[#C8923A] font-medium">x{inCart.quantity}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {discount ? (
                            <>
                              <span className="flex items-center gap-1 text-xs text-green-400">
                                <Tag className="h-3 w-3" />-{discount.percent}%
                              </span>
                              <span className="text-xs text-[var(--text-muted)] line-through">{formatCents(s.price)}</span>
                              <span className="font-medium text-green-400">{formatCents(finalPrice)}</span>
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

          {/* Carrinho */}
          {cartItems.length > 0 && (
            <div className="border-t border-[var(--card-border)] pt-4">
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Itens selecionados ({cartItems.length})</label>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={`${item.itemType}-${item.id}`} className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      {item.itemType === 'PRODUCT' ? <Package className="h-4 w-4 text-purple-400" /> : <Scissors className="h-4 w-4 text-[#D4A85C]" />}
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                        <div className="flex items-center gap-1.5">
                          {item.hasPromo && (
                            <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Tag className="h-2.5 w-2.5" />{item.promoName}</span>
                          )}
                          <span className="text-xs text-[var(--text-muted)]">{formatCents(item.unitPrice)} un.</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
                        <button onClick={() => updateCartQty(item.id, item.itemType, -1)} className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Minus className="h-3 w-3" /></button>
                        <span className="text-sm font-medium text-[var(--text-primary)] min-w-[20px] text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.id, item.itemType, 1)} className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)] min-w-[70px] text-right">{formatCents(item.unitPrice * item.quantity)}</span>
                      <button onClick={() => removeFromCart(item.id, item.itemType)} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-red-500/20 hover:text-[#C45050]"><X className="h-4 w-4" /></button>
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
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] p-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Subtotal:</span>
                <span className="font-bold text-[var(--text-primary)]">{formatCents(itemPreviewPrice)}</span>
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
        </div>
      </Modal>

      {/* Delete Modal */}
      {deletingOrder && (
        <ConfirmModal isOpen={!!deletingOrder} onClose={() => setDeletingOrder(null)} onConfirm={handleDelete} isLoading={deleteOrder.isPending} title="Excluir Comanda" message="Tem certeza que deseja excluir esta comanda?" />
      )}
    </div>
  );
}
