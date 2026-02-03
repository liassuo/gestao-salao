import { Package, Pencil, Trash2 } from 'lucide-react';
import type { Product } from '@/types';

interface ProductsTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProductsTable({ products, onEdit, onDelete }: ProductsTableProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
        <Package className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Nome</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Custo</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Venda</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Est. Mín.</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Status</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-[var(--text-muted)]">Ações</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-[var(--card-border)] transition-colors hover:bg-[var(--hover-bg)]">
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{product.name}</p>
                  {product.description && <p className="text-sm text-[var(--text-muted)]">{product.description}</p>}
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{formatCents(product.costPrice)}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{formatCents(product.salePrice)}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{product.minStock}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${product.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {product.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => onEdit(product)} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-blue-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => onDelete(product)} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
