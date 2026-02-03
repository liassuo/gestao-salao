import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockService } from '@/services/stock';
import type { CreateStockMovementPayload, StockMovementFilters } from '@/types';

const STOCK_MOVEMENTS_KEY = ['stock', 'movements'];
const STOCK_KEY = ['products', 'stock'];

export function useStockMovements(filters?: StockMovementFilters) {
  return useQuery({
    queryKey: [...STOCK_MOVEMENTS_KEY, filters],
    queryFn: () => stockService.listMovements(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStockMovementPayload) => stockService.createMovement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOCK_MOVEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: STOCK_KEY });
    },
  });
}
