import { ArrowDown, ArrowUp, Package } from 'lucide-react';
import type { StockMovement } from '@/types';
import { stockMovementTypeLabels, stockMovementTypeColors } from '@/types';

interface StockMovementsTableProps {
  movements: StockMovement[];
}

export function StockMovementsTable({ movements }: StockMovementsTableProps) {
  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
        <Package className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">Nenhuma movimentação encontrada</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Tipo</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Produto</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Quantidade</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Motivo</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Data</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-b border-[var(--card-border)] transition-colors hover:bg-[var(--hover-bg)]">
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${stockMovementTypeColors[m.type]}`}>
                  {m.type === 'ENTRY' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                  {stockMovementTypeLabels[m.type]}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{m.product?.name || 'Produto'}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{m.quantity}</td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{m.reason || '-'}</td>
              <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(m.createdAt).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
