import { useState } from 'react';
import { Warehouse, AlertCircle } from 'lucide-react';
import { useProductStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { StockTable } from '@/components/products';

export function StockCurrent() {
  const [branchId, setBranchId] = useState<string>('');
  const { data: stock, isLoading, error } = useProductStock(branchId || undefined);
  const { data: branches } = useBranches();

  const totalStockValue = stock?.reduce((acc, p) => acc + p.stockValue, 0) || 0;
  const totalSaleValue = stock?.reduce((acc, p) => acc + p.potentialSaleValue, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><Warehouse className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Estoque Atual</h1>
            <p className="text-sm text-[var(--text-muted)]">Visão geral do estoque de produtos</p>
          </div>
        </div>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-xl border border-[var(--card-border)] bg-[var(--hover-bg)] px-3 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">Todas as filiais</option>
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <p className="text-sm text-[var(--text-muted)]">Valor Total em Estoque</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{(totalStockValue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <p className="text-sm text-[var(--text-muted)]">Potencial de Venda</p>
          <p className="text-2xl font-bold text-green-400">{(totalSaleValue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400"><AlertCircle className="h-5 w-5" /><span>Erro ao carregar estoque</span></div>
        ) : (
          <StockTable stock={stock || []} />
        )}
      </div>
    </div>
  );
}
