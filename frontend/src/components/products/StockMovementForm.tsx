import { useForm } from 'react-hook-form';
import type { CreateStockMovementPayload, Product } from '@/types';
import { useBranches } from '@/hooks/useBranches';

interface StockMovementFormProps {
  products: Product[];
  onSubmit: (payload: CreateStockMovementPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

interface FormData {
  productId: string;
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  reason: string;
  branchId: string;
}

export function StockMovementForm({ products, onSubmit, isLoading, error }: StockMovementFormProps) {
  const { data: branches } = useBranches();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { productId: '', type: 'ENTRY', quantity: 1, reason: '', branchId: '' },
  });

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      productId: data.productId,
      type: data.type,
      quantity: data.quantity,
      reason: data.reason || undefined,
      branchId: data.branchId || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Produto *</label>
        <select {...register('productId', { required: 'Selecione um produto' })} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">Selecione...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {errors.productId && <p className="mt-1 text-xs text-red-400">{errors.productId.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Tipo *</label>
          <select {...register('type')} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="ENTRY">Entrada</option>
            <option value="EXIT">Saída</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Quantidade *</label>
          <input type="number" min="1" {...register('quantity', { required: true, valueAsNumber: true, min: 1 })} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Motivo</label>
        <input {...register('reason')} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Motivo da movimentação" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Filial</label>
        <select {...register('branchId')} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">Todas</option>
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
        {isLoading ? 'Registrando...' : 'Registrar Movimentação'}
      </button>
    </form>
  );
}
