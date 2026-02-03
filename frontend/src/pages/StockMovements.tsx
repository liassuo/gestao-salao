import { useState } from 'react';
import { ArrowLeftRight, Plus, AlertCircle } from 'lucide-react';
import { useStockMovements, useCreateStockMovement, useProducts, getApiErrorMessage } from '@/hooks';
import { StockMovementForm, StockMovementsTable } from '@/components/products';
import { Modal, useToast } from '@/components/ui';
import type { CreateStockMovementPayload } from '@/types';

export function StockMovements() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: movements, isLoading, error } = useStockMovements();
  const { data: products } = useProducts();
  const createMovement = useCreateStockMovement();
  const toast = useToast();

  const handleCreate = async (payload: CreateStockMovementPayload) => {
    try {
      setFormError(null);
      await createMovement.mutateAsync(payload);
      toast.success('Movimentação registrada com sucesso');
      setIsCreateModalOpen(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><ArrowLeftRight className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Entrada e Saída</h1>
            <p className="text-sm text-[var(--text-muted)]">Movimentações de estoque</p>
          </div>
        </div>
        <button onClick={() => { setFormError(null); setIsCreateModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nova Movimentação
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400"><AlertCircle className="h-5 w-5" /><span>Erro ao carregar movimentações</span></div>
        ) : (
          <StockMovementsTable movements={movements || []} />
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Nova Movimentação">
        <StockMovementForm products={products || []} onSubmit={handleCreate} isLoading={createMovement.isPending} error={formError} />
      </Modal>
    </div>
  );
}
