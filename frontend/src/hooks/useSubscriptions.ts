import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsService } from '@/services';
import type { CreatePlanPayload, UpdatePlanPayload, SubscribeClientPayload } from '@/types';

export const SUBSCRIPTION_PLANS_KEY = 'subscription-plans';
export const SUBSCRIPTIONS_KEY = 'subscriptions';

// ============================================
// SUBSCRIPTION PLANS HOOKS
// ============================================

export function useSubscriptionPlans(includeInactive: boolean = false) {
  return useQuery({
    queryKey: [SUBSCRIPTION_PLANS_KEY, { includeInactive }],
    queryFn: () => subscriptionsService.listPlans(includeInactive),
  });
}

export function useSubscriptionPlan(id: string | undefined) {
  return useQuery({
    queryKey: [SUBSCRIPTION_PLANS_KEY, id],
    queryFn: () => subscriptionsService.getPlan(id!),
    enabled: !!id,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePlanPayload) => subscriptionsService.createPlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTION_PLANS_KEY] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePlanPayload }) =>
      subscriptionsService.updatePlan(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTION_PLANS_KEY] });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => subscriptionsService.deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTION_PLANS_KEY] });
    },
  });
}

// ============================================
// CLIENT SUBSCRIPTIONS HOOKS
// ============================================

export function useClientSubscriptions(status?: string) {
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, { status }],
    queryFn: () => subscriptionsService.listSubscriptions(status),
  });
}

export function useClientSubscription(clientId: string | undefined) {
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, 'client', clientId],
    queryFn: () => subscriptionsService.getClientSubscription(clientId!),
    enabled: !!clientId,
  });
}

export function useSubscribeClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubscribeClientPayload) => subscriptionsService.subscribe(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTION_PLANS_KEY] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => subscriptionsService.cancelSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTION_PLANS_KEY] });
    },
  });
}

export function useUseCut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => subscriptionsService.useCut(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
    },
  });
}

export function useRemainingCuts(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, 'remaining-cuts', subscriptionId],
    queryFn: () => subscriptionsService.getRemainingCuts(subscriptionId!),
    enabled: !!subscriptionId,
  });
}
