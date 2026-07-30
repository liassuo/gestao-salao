import { api } from './api';
import type {
  SubscriptionPlan,
  ClientSubscription,
  CreatePlanPayload,
  UpdatePlanPayload,
  SubscribeClientPayload,
  RemainingCuts,
} from '@/types';

export const subscriptionsService = {
  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================

  async listPlans(includeInactive: boolean = false): Promise<SubscriptionPlan[]> {
    const params = includeInactive ? { all: 'true' } : {};
    const response = await api.get<SubscriptionPlan[]>('/subscriptions/plans', { params });
    return response.data;
  },

  async getPlan(id: string): Promise<SubscriptionPlan> {
    const response = await api.get<SubscriptionPlan>(`/subscriptions/plans/${id}`);
    return response.data;
  },

  async createPlan(payload: CreatePlanPayload): Promise<SubscriptionPlan> {
    const response = await api.post<SubscriptionPlan>('/subscriptions/plans', payload);
    return response.data;
  },

  async updatePlan(id: string, payload: UpdatePlanPayload): Promise<SubscriptionPlan> {
    const response = await api.patch<SubscriptionPlan>(`/subscriptions/plans/${id}`, payload);
    return response.data;
  },

  async deletePlan(id: string): Promise<void> {
    await api.delete(`/subscriptions/plans/${id}`);
  },

  // ============================================
  // CLIENT SUBSCRIPTIONS
  // ============================================

  async listSubscriptions(status?: string): Promise<ClientSubscription[]> {
    const params = status ? { status } : {};
    const response = await api.get<ClientSubscription[]>('/subscriptions', { params });
    return response.data;
  },

  async getSubscription(id: string): Promise<ClientSubscription> {
    const response = await api.get<ClientSubscription>(`/subscriptions/${id}`);
    return response.data;
  },

  async getClientSubscription(clientId: string): Promise<ClientSubscription | null> {
    const response = await api.get<ClientSubscription | null>(`/subscriptions/client/${clientId}`);
    return response.data;
  },

  async subscribe(payload: SubscribeClientPayload): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>('/subscriptions/subscribe', payload);
    return response.data;
  },

  // Concede uma assinatura ao cliente até endDate (ISO, máx 1 mês). Admin only.
  // Sem paymentMethod = cortesia grátis (sem caixa). Com paymentMethod = 1ª
  // mensalidade contabilizada no caixa pelo método informado.
  async grantCourtesy(payload: {
    clientId: string;
    planId: string;
    endDate: string;
    paymentMethod?: 'CASH' | 'PIX' | 'CARD';
  }): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>('/subscriptions/grant', payload);
    return response.data;
  },

  async cancelSubscription(id: string, immediate?: boolean): Promise<ClientSubscription> {
    const url = immediate
      ? `/subscriptions/${id}/cancel?immediate=true`
      : `/subscriptions/${id}/cancel`;
    const response = await api.post<ClientSubscription>(url);
    return response.data;
  },

  async reconcileWithAsaas(): Promise<{ checked: number; activated: number; errors: number; configured: boolean }> {
    const response = await api.post<{ checked: number; activated: number; errors: number; configured: boolean }>(
      '/subscriptions/admin/reconcile-asaas',
    );
    return response.data;
  },

  async getReconcileReport(days = 7): Promise<{
    configured: boolean;
    issues: Array<{
      asaasPaymentId: string;
      asaasStatus: string;
      amount: number;
      confirmedAt: string | null;
      issue: 'PAYMENT_MISSING' | 'PAYMENT_UNPAID' | 'APPOINTMENT_CANCELED';
      kind: 'subscription' | 'appointment' | 'unknown';
      clientId: string | null;
      clientName: string | null;
      description: string;
      suggestedAction: string;
    }>;
  }> {
    const response = await api.get('/subscriptions/admin/reconcile-report', { params: { days } });
    return response.data;
  },

  async applyReconciliation(asaasPaymentId: string): Promise<{ success: boolean; action: string; message: string }> {
    const response = await api.post(`/subscriptions/admin/reconcile-apply/${asaasPaymentId}`);
    return response.data;
  },

  async useCut(id: string): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>(`/subscriptions/${id}/use-cut`);
    return response.data;
  },

  async resetCuts(id: string): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>(`/subscriptions/${id}/reset-cuts`);
    return response.data;
  },

  async getRemainingCuts(id: string): Promise<RemainingCuts> {
    const response = await api.get<RemainingCuts>(`/subscriptions/${id}/remaining-cuts`);
    return response.data;
  },

  async getPendingPix(id: string): Promise<any> {
    const response = await api.get<any>(`/subscriptions/${id}/pending-pix`);
    return response.data;
  },

  async regeneratePix(id: string): Promise<any> {
    const response = await api.post<any>(`/subscriptions/${id}/regenerate-pix`);
    return response.data;
  },

  // Gera o link de pagamento Asaas (invoiceUrl) para o cliente renovar.
  // healed=true: o backend achou o pagamento já feito no Asaas (ex.: recorrência
  // de cartão debitou e o webhook se perdeu), reativou por reconciliação e NÃO
  // gerou link — nada a enviar ao cliente.
  async renewViaAsaas(id: string): Promise<{
    invoiceUrl: string | null;
    healed?: boolean;
    message?: string;
    client: { name: string | null; phone: string | null };
    planName: string | null;
  }> {
    const response = await api.post(`/subscriptions/${id}/renew-asaas`);
    return response.data;
  },

  // Gera o link de pagamento Asaas (invoiceUrl) do CICLO ATUAL de uma assinatura
  // ativa com ciclo não pago — mesmo shape do renewViaAsaas, sem renovar o ciclo.
  async chargeCurrentCycle(id: string): Promise<{
    invoiceUrl: string | null;
    healed?: boolean;
    message?: string;
    client: { name: string | null; phone: string | null };
    planName: string | null;
  }> {
    const response = await api.post(`/subscriptions/${id}/charge-cycle`);
    return response.data;
  },

  // Debita o ciclo atual DIRETO no cartão salvo do cliente (sem reabrir link).
  // Só funciona se o cliente tem cartão tokenizado (hasCardOnFile). Não renova o
  // vencimento. Cartão recusado / sem token → erro 400 tratado no chamador.
  async chargeCurrentCycleCard(id: string): Promise<{
    charged: boolean;
    confirmed: boolean;
    status: string;
    client: { name: string | null; phone: string | null };
    planName: string | null;
    cardLabel: string | null;
  }> {
    const response = await api.post(`/subscriptions/${id}/charge-cycle-card`);
    return response.data;
  },

  async confirmPayment(
    id: string,
    method: 'CASH' | 'PIX' | 'CARD' = 'CASH',
  ): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>(
      `/subscriptions/${id}/confirm-payment`,
      { method },
    );
    return response.data;
  },

  // Confirma o pagamento do ciclo vigente de uma assinatura ATIVA não paga (pagou
  // por fora). Só registra o pagamento — não renova vencimento nem zera cortes.
  async confirmCyclePayment(
    id: string,
    method: 'CASH' | 'PIX' | 'CARD' = 'CASH',
  ): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>(
      `/subscriptions/${id}/confirm-cycle`,
      { method },
    );
    return response.data;
  },

  async syncWithAsaas(id: string): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>(`/subscriptions/${id}/sync-asaas`);
    return response.data;
  },

  async deleteSubscription(id: string): Promise<void> {
    await api.delete(`/subscriptions/${id}`);
  },
};
