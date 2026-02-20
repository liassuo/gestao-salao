import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { BankAccount, CreateBankAccountPayload } from '@/types';

interface BankAccountFormData {
  name: string;
  bank: string;
  accountType: string;
}

interface BankAccountFormProps {
  bankAccount?: BankAccount | null;
  onSubmit: (payload: CreateBankAccountPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function BankAccountForm({ bankAccount, onSubmit, isLoading, error }: BankAccountFormProps) {
  const isEditing = !!bankAccount;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BankAccountFormData>({
    defaultValues: {
      name: bankAccount?.name || '',
      bank: bankAccount?.bank || '',
      accountType: bankAccount?.accountType || '',
    },
  });

  const handleFormSubmit = async (data: BankAccountFormData) => {
    await onSubmit({
      name: data.name,
      bank: data.bank || undefined,
      accountType: data.accountType || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[#A63030]" />
          <div>
            <p className="font-medium text-[#A63030]">Erro ao salvar</p>
            <p className="text-sm text-[#C45050]">{error}</p>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Nome *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome é obrigatório' })}
          placeholder="Nome da conta bancária"
          className={`w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
            errors.name ? 'border-[#A63030]' : 'border-[var(--border-color)]'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-[#A63030]">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Banco
        </label>
        <input
          type="text"
          {...register('bank')}
          placeholder="Nome do banco (opcional)"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Tipo de Conta
        </label>
        <select
          {...register('accountType')}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        >
          <option value="">Selecione (opcional)</option>
          <option value="Conta corrente">Conta corrente</option>
          <option value="Conta poupança">Conta poupança</option>
          <option value="Conta pagamento">Conta pagamento</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
