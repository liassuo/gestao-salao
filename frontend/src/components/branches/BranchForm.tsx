import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Branch, CreateBranchPayload } from '@/types';

interface BranchFormData {
  name: string;
  address: string;
  phone: string;
}

interface BranchFormProps {
  branch?: Branch | null;
  onSubmit: (payload: CreateBranchPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function BranchForm({ branch, onSubmit, isLoading, error }: BranchFormProps) {
  const isEditing = !!branch;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormData>({
    defaultValues: {
      name: branch?.name || '',
      address: branch?.address || '',
      phone: branch?.phone || '',
    },
  });

  const handleFormSubmit = async (data: BranchFormData) => {
    await onSubmit({
      name: data.name,
      address: data.address || undefined,
      phone: data.phone || undefined,
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
          placeholder="Nome da filial"
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
          Endereço
        </label>
        <input
          type="text"
          {...register('address')}
          placeholder="Endereço da filial (opcional)"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Telefone
        </label>
        <input
          type="tel"
          {...register('phone')}
          placeholder="(11) 99999-9999 (opcional)"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
        />
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
