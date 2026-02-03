import { Package, AlertTriangle } from 'lucide-react';
import type { ProductStock } from '@/types';

interface StockTableProps {
  stock: ProductStock[];
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function StockTable({ stock }: StockTableProps) {
  if (stock.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
        <Package className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">Nenhum produto no estoque</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Produto</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Qtd. Atual</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Mínimo</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Valor Estoque</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Potencial Venda</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Status</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((item) => (
            <tr key={item.id} className="border-b border-[var(--card-border)] transition-colors hover:bg-[var(--hover-bg)]">
              <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                <div className="flex items-center gap-2">
                  {item.isLowStock && <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                  {item.name}
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{item.currentStock}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{item.minStock}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{formatCents(item.stockValue)}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{formatCents(item.potentialSaleValue)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.isLowStock ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                  {item.isLowStock ? 'Estoque Baixo' : 'Normal'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
