import { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { useCreateFinancialTransaction, getApiErrorMessage } from '@/hooks';
import { TransactionForm } from '@/components/financial/TransactionForm';
import { useToast } from '@/components/ui';
import type { CreateFinancialTransactionPayload } from '@/types';

export function CreateExpense() {
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const createTransaction = useCreateFinancialTransaction();
  const toast = useToast();

  const handleSubmit = async (payload: CreateFinancialTransactionPayload) => {
    setError(null);
    try {
      await createTransaction.mutateAsync(payload);
      toast.success('Despesa criada', 'A despesa foi registrada com sucesso.');
      setFormKey((prev) => prev + 1);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
          <TrendingDown className="h-5 w-5 text-[#A63030]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Criar Despesa</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Registre uma nova despesa ou conta a pagar
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="mx-auto max-w-2xl rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
        <TransactionForm
          key={formKey}
          type="EXPENSE"
          onSubmit={handleSubmit}
          isLoading={createTransaction.isPending}
          error={error}
        />
      </div>
    </div>
  );
}
