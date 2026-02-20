import { PackageX } from 'lucide-react';
import type { LowStockProduct } from '@/types/dashboard';

interface LowStockCardProps {
  products: LowStockProduct[];
}

export function LowStockCard({ products }: LowStockCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-colors duration-200">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-600 to-orange-500 shadow-lg shadow-orange-500/20">
          <PackageX className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Estoque Baixo</h3>
      </div>

      {products.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhum produto com estoque baixo.</p>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const ratio = product.currentStock / product.minStock;
            const isUrgent = ratio <= 0.5;

            return (
              <div
                key={product.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  isUrgent
                    ? 'border-[#A63030]/30 bg-red-500/10'
                    : 'border-orange-500/30 bg-orange-500/10'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{product.name}</p>
                  <p className={`text-xs font-medium ${isUrgent ? 'text-[#C45050]' : 'text-orange-400'}`}>
                    {isUrgent ? 'Estoque crítico' : 'Estoque baixo'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-lg font-bold ${isUrgent ? 'text-[#C45050]' : 'text-orange-400'}`}>
                    {product.currentStock}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">/ {product.minStock}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
