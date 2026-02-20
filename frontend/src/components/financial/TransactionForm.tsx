import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  useFinancialCategories,
  useActiveBranches,
  useActiveBankAccounts,
  usePaymentMethodConfigs,
} from '@/hooks';
import type { TransactionType, CreateFinancialTransactionPayload, PaymentCondition } from '@/types';
import { paymentConditionLabels } from '@/types';

interface TransactionFormProps {
  type: TransactionType;
  onSubmit: (payload: CreateFinancialTransactionPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

interface FormValues {
  description: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  branchId: string;
  paymentCondition: PaymentCondition;
  paymentMethodConfigId: string;
  bankAccountId: string;
  dueDate: string;
  discount: string;
  interest: string;
  isRecurring: boolean;
  notes: string;
}

export function TransactionForm({ type, onSubmit, isLoading, error }: TransactionFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      description: '',
      amount: '',
      categoryId: '',
      subcategoryId: '',
      branchId: '',
      paymentCondition: 'A_VISTA',
      paymentMethodConfigId: '',
      bankAccountId: '',
      dueDate: '',
      discount: '',
      interest: '',
      isRecurring: false,
      notes: '',
    },
  });

  const selectedCategoryId = watch('categoryId');

  const { data: categories } = useFinancialCategories({ type, isActive: true });
  const { data: subcategories } = useFinancialCategories(
    selectedCategoryId ? { parentId: selectedCategoryId, isActive: true } : undefined
  );
  const { data: branches } = useActiveBranches();
  const { data: bankAccounts } = useActiveBankAccounts();
  const { data: paymentMethods } = usePaymentMethodConfigs({ isActive: true });

  const parentCategories = categories?.filter((cat) => !cat.parentId) || [];

  const onFormSubmit = async (data: FormValues) => {
    const amountCents = Math.round(parseFloat(data.amount.replace(',', '.')) * 100);

    const payload: CreateFinancialTransactionPayload = {
      type,
      description: data.description,
      amount: amountCents,
      categoryId: data.categoryId,
      paymentCondition: data.paymentCondition,
      dueDate: data.dueDate,
      discount: data.discount ? parseFloat(data.discount.replace(',', '.')) : undefined,
      interest: data.interest ? parseFloat(data.interest.replace(',', '.')) : undefined,
      isRecurring: data.isRecurring,
      notes: data.notes || undefined,
      subcategoryId: data.subcategoryId || undefined,
      branchId: data.branchId || undefined,
      bankAccountId: data.bankAccountId || undefined,
      paymentMethodConfigId: data.paymentMethodConfigId || undefined,
    };

    await onSubmit(payload);
  };

  // Reset subcategory when category changes
  useEffect(() => {
    // Handled via watch - subcategory list updates automatically
  }, [selectedCategoryId]);

  const buttonColor = type === 'EXPENSE'
    ? 'bg-[#8B2020] hover:bg-[#6B1818]'
    : 'bg-emerald-600 hover:bg-emerald-700';

  const buttonLabel = type === 'EXPENSE' ? 'Criar Despesa' : 'Criar Receita';

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Descricao */}
      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Descricao *
        </label>
        <input
          type="text"
          id="description"
          {...register('description', { required: 'Descricao e obrigatoria' })}
          placeholder="Descricao do lancamento"
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-[#A63030]">{errors.description.message}</p>
        )}
      </div>

      {/* Valor */}
      <div>
        <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Valor (R$) *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            R$
          </span>
          <input
            type="text"
            id="amount"
            {...register('amount', {
              required: 'Valor e obrigatorio',
              validate: (value) => {
                const num = parseFloat(value.replace(',', '.'));
                return (!isNaN(num) && num > 0) || 'Valor deve ser maior que zero';
              },
            })}
            placeholder="0,00"
            className="w-full rounded-xl border bg-[var(--hover-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
          />
        </div>
        {errors.amount && (
          <p className="mt-1 text-xs text-[#A63030]">{errors.amount.message}</p>
        )}
      </div>

      {/* Categoria */}
      <div>
        <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Categoria *
        </label>
        <select
          id="categoryId"
          {...register('categoryId', { required: 'Categoria e obrigatoria' })}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
        >
          <option value="">Selecione uma categoria</option>
          {parentCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="mt-1 text-xs text-[#A63030]">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Subcategoria */}
      {subcategories && subcategories.length > 0 && (
        <div>
          <label htmlFor="subcategoryId" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Subcategoria
          </label>
          <select
            id="subcategoryId"
            {...register('subcategoryId')}
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
          >
            <option value="">Selecione uma subcategoria</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filial */}
      <div>
        <label htmlFor="branchId" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Filial
        </label>
        <select
          id="branchId"
          {...register('branchId')}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
        >
          <option value="">Selecione uma filial</option>
          {branches?.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Condicao de Pagamento + Forma de Pagamento */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="paymentCondition" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Condicao de Pagamento
          </label>
          <select
            id="paymentCondition"
            {...register('paymentCondition')}
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
          >
            {(Object.keys(paymentConditionLabels) as PaymentCondition[]).map((key) => (
              <option key={key} value={key}>
                {paymentConditionLabels[key]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="paymentMethodConfigId" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Forma de Pagamento
          </label>
          <select
            id="paymentMethodConfigId"
            {...register('paymentMethodConfigId')}
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
          >
            <option value="">Selecione</option>
            {paymentMethods?.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conta Bancaria */}
      <div>
        <label htmlFor="bankAccountId" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Conta Bancaria
        </label>
        <select
          id="bankAccountId"
          {...register('bankAccountId')}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
        >
          <option value="">Selecione uma conta</option>
          {bankAccounts?.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {/* Data de Vencimento */}
      <div>
        <label htmlFor="dueDate" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Data de Vencimento *
        </label>
        <input
          type="date"
          id="dueDate"
          {...register('dueDate', { required: 'Data de vencimento e obrigatoria' })}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
        />
        {errors.dueDate && (
          <p className="mt-1 text-xs text-[#A63030]">{errors.dueDate.message}</p>
        )}
      </div>

      {/* Desconto e Juros */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="discount" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Desconto (%)
          </label>
          <input
            type="text"
            id="discount"
            {...register('discount')}
            placeholder="0"
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
          />
        </div>
        <div>
          <label htmlFor="interest" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Juros (%)
          </label>
          <input
            type="text"
            id="interest"
            {...register('interest')}
            placeholder="0"
            className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
          />
        </div>
      </div>

      {/* Recorrente */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isRecurring"
          {...register('isRecurring')}
          className="h-4 w-4 rounded border-[var(--border-color)] bg-[var(--hover-bg)] text-[#C8923A] focus:ring-[#C8923A]"
        />
        <label htmlFor="isRecurring" className="text-sm font-medium text-[var(--text-secondary)]">
          Lancamento recorrente
        </label>
      </div>

      {/* Observacoes */}
      <div>
        <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
          Observacoes
        </label>
        <textarea
          id="notes"
          {...register('notes')}
          placeholder="Observacoes adicionais..."
          rows={3}
          className="w-full rounded-xl border bg-[var(--hover-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] border-[var(--border-color)]"
        />
      </div>

      {/* Botao Submit */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)]"
        >
          Limpar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonColor}`}
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Salvando...' : buttonLabel}
        </button>
      </div>
    </form>
  );
}
