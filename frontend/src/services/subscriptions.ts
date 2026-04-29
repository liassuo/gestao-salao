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

  async cancelSubscription(id: string): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>(`/subscriptions/${id}/cancel`);
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

  async confirmPayment(id: string): Promise<ClientSubscription> {
    const response = await api.post<ClientSubscription>(`/subscriptions/${id}/confirm-payment`);
    return response.data;
  },

  async deleteSubscription(id: string): Promise<void> {
    await api.delete(`/subscriptions/${id}`);
  },
};
