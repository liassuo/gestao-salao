import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersService } from '@/services/orders';
import type { CreateOrderPayload, AddOrderItemPayload, OrderFilters } from '@/types';

const ORDERS_KEY = ['orders'];

export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: [...ORDERS_KEY, filters],
    queryFn: () => ordersService.list(filters),
    staleTime: 30 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id],
    queryFn: () => ordersService.getById(id),
    enabled: !!id,
  });
}

export function useOrderByAppointment(appointmentId?: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'by-appointment', appointmentId],
    queryFn: () => ordersService.getByAppointment(appointmentId!),
    enabled: !!appointmentId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => ordersService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useAddOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: AddOrderItemPayload }) =>
      ordersService.addItem(orderId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useRemoveOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      ordersService.removeItem(orderId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      paymentMethod?: string;
      billingType?: string;
      dueDate?: string;
      asProfessionalDebt?: boolean;
      consumerProfessionalId?: string;
    }) => ordersService.pay(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: ['professional-debts'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ordersService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: ['professional-debts'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ordersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
