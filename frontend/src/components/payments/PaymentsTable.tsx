import { useState } from 'react';
import { CreditCard, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Payment } from '@/types';
import { paymentMethodLabels, paymentMethodColors } from '@/types';
import { EmptyState } from '@/components/ui';

interface PaymentsTableProps {
  payments: Payment[];
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  isLoading?: boolean;
  onNewPayment?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDateTime(dateTime: string): string {
  return new Date(dateTime).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateTime: string): string {
  return new Date(dateTime).toLocaleDateString('pt-BR');
}

export function PaymentsTable({
  payments,
  onEdit,
  onDelete,
  isLoading,
  onNewPayment,
}: PaymentsTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Nenhum pagamento registrado"
        description="Você ainda não possui pagamentos para este período. Registre um novo pagamento para começar."
        action={onNewPayment ? { label: 'Novo Pagamento', onClick: onNewPayment } : undefined}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Método
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Agendamento
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Registrado por
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {formatDateTime(payment.paidAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {payment.client.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      paymentMethodColors[payment.method]
                    }`}
                  >
                    {paymentMethodLabels[payment.method]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {payment.appointment
                    ? formatDate(payment.appointment.scheduledAt)
                    : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {payment.registeredBy.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <PaymentActions
                    payment={payment}
                    isOpen={openMenuId === payment.id}
                    onToggle={() =>
                      setOpenMenuId(openMenuId === payment.id ? null : payment.id)
                    }
                    onClose={() => setOpenMenuId(null)}
                    onEdit={() => {
                      onEdit(payment);
                      setOpenMenuId(null);
                    }}
                    onDelete={() => {
                      onDelete(payment);
                      setOpenMenuId(null);
                    }}
                    disabled={isLoading}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PaymentActionsProps {
  payment: Payment;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

function PaymentActions({
  isOpen,
  onToggle,
  onClose,
  onEdit,
  onDelete,
  disabled,
}: PaymentActionsProps) {
  return (
    <div className="relative inline-block">
      <button
        onClick={onToggle}
        disabled={disabled}
        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={onEdit}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
            <button
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </>
      )}
    </div>
  );
}
