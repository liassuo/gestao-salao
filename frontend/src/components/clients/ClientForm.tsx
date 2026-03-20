import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import { formatPhoneInput } from '@/utils/format';
import type { Client, CreateClientPayload } from '@/types';

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

interface ClientFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  birthDate: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
}

interface ClientFormProps {
  client?: Client | null;
  onSubmit: (payload: CreateClientPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}


const inputClass = (hasError: boolean) =>
  `w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] ${
    hasError ? 'border-[#A63030]' : 'border-[var(--border-color)]'
  }`;

export function ClientForm({ client, onSubmit, isLoading, error }: ClientFormProps) {
  const isEditing = !!client;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClientFormData>({
    defaultValues: {
      name: client?.name || '',
      phone: client?.phone ? formatPhoneInput(client.phone) : '',
      email: client?.email || '',
      cpf: client?.cpf ? formatCpfInput(client.cpf) : '',
      birthDate: client?.birthDate ? client.birthDate.slice(0, 10) : '',
      address: client?.address || '',
      addressNumber: client?.addressNumber || '',
      neighborhood: client?.neighborhood || '',
      city: client?.city || '',
      state: client?.state || '',
      notes: client?.notes || '',
    },
  });

  const handleFormSubmit = async (data: ClientFormData) => {
    await onSubmit({
      name: data.name,
      phone: data.phone.replace(/\D/g, ''),
      email: data.email || undefined,
      cpf: data.cpf.replace(/\D/g, '') || undefined,
      birthDate: data.birthDate || undefined,
      address: data.address || undefined,
      addressNumber: data.addressNumber || undefined,
      neighborhood: data.neighborhood || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      notes: data.notes || undefined,
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

      {/* Dados pessoais */}
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Dados Pessoais
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Nome *
          </label>
          <input
            type="text"
            {...register('name', { required: 'Nome é obrigatório' })}
            placeholder="Nome completo"
            className={inputClass(!!errors.name)}
          />
          {errors.name && <p className="mt-1 text-sm text-[#A63030]">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            CPF
          </label>
          <input
            type="text"
            {...register('cpf', {
              pattern: {
                value: /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})?$/,
                message: 'CPF inválido',
              },
              onChange: (e) => {
                setValue('cpf', formatCpfInput(e.target.value));
              },
            })}
            placeholder="000.000.000-00"
            className={inputClass(!!errors.cpf)}
          />
          {errors.cpf && <p className="mt-1 text-sm text-[#A63030]">{errors.cpf.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Telefone *
          </label>
          <input
            type="tel"
            {...register('phone', {
              required: 'Telefone é obrigatório',
              pattern: {
                value: /^[\d\s()-]+$/,
                message: 'Telefone inválido',
              },
              onChange: (e) => {
                setValue('phone', formatPhoneInput(e.target.value));
              },
            })}
            placeholder="(11) 99999-9999"
            className={inputClass(!!errors.phone)}
          />
          {errors.phone && <p className="mt-1 text-sm text-[#A63030]">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            E-mail
          </label>
          <input
            type="email"
            {...register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'E-mail inválido',
              },
            })}
            placeholder="email@exemplo.com"
            className={inputClass(!!errors.email)}
          />
          {errors.email && <p className="mt-1 text-sm text-[#A63030]">{errors.email.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Data de Nascimento
          </label>
          <input
            type="date"
            {...register('birthDate')}
            className={inputClass(false)}
          />
        </div>
      </div>

      {/* Endereço */}
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] pt-2">
        Endereço
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Logradouro
          </label>
          <input
            type="text"
            {...register('address')}
            placeholder="Rua, Avenida..."
            className={inputClass(false)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Número
          </label>
          <input
            type="text"
            {...register('addressNumber')}
            placeholder="123"
            className={inputClass(false)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Bairro
          </label>
          <input
            type="text"
            {...register('neighborhood')}
            placeholder="Bairro"
            className={inputClass(false)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Cidade
          </label>
          <input
            type="text"
            {...register('city')}
            placeholder="Cidade"
            className={inputClass(false)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            UF
          </label>
          <select
            {...register('state')}
            className={inputClass(false)}
          >
            <option value="">Selecione</option>
            {UF_OPTIONS.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Observações
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Informações adicionais sobre o cliente"
          className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
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
