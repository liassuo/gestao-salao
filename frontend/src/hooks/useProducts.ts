import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsService } from '@/services/products';
import type { CreateProductPayload, UpdateProductPayload, ProductFilters } from '@/types';

const PRODUCTS_KEY = ['products'];
const STOCK_KEY = ['products', 'stock'];

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, filters],
    queryFn: () => productsService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, id],
    queryFn: () => productsService.getById(id),
    enabled: !!id,
  });
}

export function useProductStock(branchId?: string) {
  return useQuery({
    queryKey: [...STOCK_KEY, branchId],
    queryFn: () => productsService.getStock(branchId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useLowStockProducts(branchId?: string) {
  return useQuery({
    queryKey: [...STOCK_KEY, 'low', branchId],
    queryFn: () => productsService.getLowStock(branchId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProductPayload) => productsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProductPayload }) =>
      productsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}
