import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Product, CreateProductPayload } from '@/types';
import { useBranches } from '@/hooks/useBranches';

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (payload: CreateProductPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

interface FormData {
  name: string;
  description: string;
  costPrice: string;
  salePrice: string;
  minStock: number;
  branchId: string;
}

function formatCurrency(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const cents = parseInt(numbers, 10);
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(value: string): number {
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
}

export function ProductForm({ product, onSubmit, isLoading, error }: ProductFormProps) {
  const isEditing = !!product;
  const { data: branches } = useBranches();
  const [costDisplay, setCostDisplay] = useState(() => product?.costPrice ? formatCurrency(String(product.costPrice)) : '');
  const [saleDisplay, setSaleDisplay] = useState(() => product?.salePrice ? formatCurrency(String(product.salePrice)) : '');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      costPrice: product?.costPrice ? String(product.costPrice) : '',
      salePrice: product?.salePrice ? String(product.salePrice) : '',
      minStock: product?.minStock || 0,
      branchId: product?.branchId || '',
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      name: data.name,
      description: data.description || undefined,
      costPrice: parseCurrency(data.costPrice),
      salePrice: parseCurrency(data.salePrice),
      minStock: data.minStock,
      branchId: data.branchId || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Nome *</label>
        <input {...register('name', { required: 'Nome é obrigatório' })} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Nome do produto" />
        {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Descrição</label>
        <input {...register('description')} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Descrição" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Preço de Custo (R$) *</label>
          <input value={costDisplay} onChange={(e) => { const f = formatCurrency(e.target.value); setCostDisplay(f); setValue('costPrice', e.target.value); }} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0,00" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Preço de Venda (R$) *</label>
          <input value={saleDisplay} onChange={(e) => { const f = formatCurrency(e.target.value); setSaleDisplay(f); setValue('salePrice', e.target.value); }} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0,00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Estoque Mínimo</label>
          <input type="number" {...register('minStock', { valueAsNumber: true })} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Filial</label>
          <select {...register('branchId')} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="">Todas</option>
            {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
        {isLoading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Produto'}
      </button>
    </form>
  );
}
