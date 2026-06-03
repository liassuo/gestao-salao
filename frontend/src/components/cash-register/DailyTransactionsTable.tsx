import { useCashRegisterTransactions } from '@/hooks';
import { Loader2, Receipt, AlertCircle } from 'lucide-react';
import type { CashRegisterTransaction } from '@/types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatTime(dateStr: string): string {
  // Trata como horário local (remove sufixo de tz se houver).
  const clean = dateStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean + 'T12:00:00' : clean);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão',
  BOLETO: 'Boleto',
};

function itemsSummary(t: CashRegisterTransaction): string {
  if (!t.items?.length) return t.isSubscription ? 'Assinatura' : '—';
  return t.items
    .map((i) => (i.quantity > 1 ? `${i.quantity}x ${i.name}` : i.name))
    .join(' + ');
}

interface Props {
  cashRegisterId: string;
}

/**
 * Relação dos atendimentos que compõem a receita do dia — hora, cliente,
 * profissional, serviços e valor — com total geral conferindo com o caixa.
 */
export function DailyTransactionsTable({ cashRegisterId }: Props) {
  const { data, isLoading, isError } = useCashRegisterTransactions(cashRegisterId);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-[var(--text-muted)]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Atendimentos do dia
        </h3>
        {data && (
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            {data.count} {data.count === 1 ? 'lançamento' : 'lançamentos'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando atendimentos…
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-[#A63030]">
          <AlertCircle className="h-4 w-4" />
          Não foi possível carregar os atendimentos.
        </div>
      ) : !data || data.transactions.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">
          Nenhum atendimento registrado neste dia.
        </p>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2 pr-3 font-medium">Hora</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Profissional</th>
                  <th className="py-2 pr-3 font-medium">Serviços</th>
                  <th className="py-2 pr-3 font-medium">Método</th>
                  <th className="py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[var(--border-color)]/50 text-[var(--text-primary)]"
                  >
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">
                      {formatTime(t.paidAt)}
                    </td>
                    <td className="py-2.5 pr-3">{t.clientName ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">
                      {t.professionalName ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">
                      {itemsSummary(t)}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--text-secondary)]">
                      {METHOD_LABEL[t.method] ?? t.method}
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-[var(--text-primary)]">
                  <td colSpan={5} className="pt-3 text-right text-sm font-semibold">
                    Total
                  </td>
                  <td className="pt-3 text-right text-base font-bold text-[#C8923A]">
                    {formatCurrency(data.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="space-y-2 sm:hidden">
            {data.transactions.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-[var(--border-color)] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--text-primary)]">
                    {t.clientName ?? '—'}
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {formatCurrency(t.amount)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatTime(t.paidAt)} · {t.professionalName ?? '—'} ·{' '}
                  {METHOD_LABEL[t.method] ?? t.method}
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {itemsSummary(t)}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-[var(--hover-bg)] px-3 py-2.5">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Total</span>
              <span className="text-base font-bold text-[#C8923A]">
                {formatCurrency(data.total)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
