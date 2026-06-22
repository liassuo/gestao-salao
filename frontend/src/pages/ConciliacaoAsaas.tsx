import { useState } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { reportsService } from '../services/reports';
import type { AsaasReconciliation, AsaasReconciliationStatus } from '../types/reports';
import { formatCurrency, formatDate, firstDayOfMonthIso, todayIso } from '../utils/format';
import { Spinner, useToast, DateInput } from '../components/ui';
import { PinGate } from '../components/auth';

// Rótulo + cor por status (mesma régua do backend). Tokens de cor do tema.
const STATUS_META: Record<AsaasReconciliationStatus, { label: string; cls: string }> = {
  OK: { label: 'OK', cls: 'bg-[var(--hover-bg)] text-[var(--text-muted)]' },
  OK_COM_TAXA: { label: 'OK · taxa', cls: 'bg-[#C8923A]/20 text-[#C8923A]' },
  VALOR_DIVERGENTE: { label: 'Divergente', cls: 'bg-red-500/15 text-red-500 ring-1 ring-inset ring-red-500/30' },
  ESTORNADO: { label: 'Estornado', cls: 'bg-orange-500/15 text-orange-400 ring-1 ring-inset ring-orange-500/30' },
  AGUARDANDO_LIQUIDO: { label: 'Aguardando líquido', cls: 'bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30' },
  ERRO_CONSULTA: { label: 'Erro consulta', cls: 'bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30' },
};

// Campos *Centavos podem ser null (estorno/aguardando/erro) → exibe "—".
const money = (cents: number | null | undefined) => (cents == null ? '—' : formatCurrency(cents));

export function ConciliacaoAsaas() {
  const toast = useToast();
  const [startDate, setStartDate] = useState(() => firstDayOfMonthIso());
  const [endDate, setEndDate] = useState(() => todayIso());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AsaasReconciliation | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const result = await reportsService.getAsaasReconciliation(startDate, endDate);
      setData(result);
      if (!result.configured) {
        toast.warning('Asaas não configurado', result.message || 'Defina ASAAS_API_KEY no backend.');
      } else if (result.truncated) {
        toast.warning(
          'Período truncado',
          `Mostrando as primeiras ${result.items.length} cobranças — há mais no período.`,
        );
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Não foi possível carregar a conciliação.';
      toast.error('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      );
    }
    if (!data) {
      return (
        <div className="py-12 text-center text-[var(--text-muted)]">
          Selecione um período e clique em "Gerar".
        </div>
      );
    }
    if (!data.configured) {
      return (
        <div className="py-12 text-center text-[var(--text-muted)]">
          {data.message || 'Asaas não configurado.'}
        </div>
      );
    }
    if (data.items.length === 0) {
      return (
        <div className="py-12 text-center text-[var(--text-muted)]">
          Nenhuma cobrança Asaas no período.
        </div>
      );
    }

    const s = data.summary;
    return (
      <div className="space-y-6">
        {data.truncated && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Período truncado — mostrando as primeiras {data.items.length} cobranças. Estreite o período para ver todas.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Bruto cobrado (app)" value={money(s.totalAppAmountCentavos)} />
          <Tile label="Líquido recebido (Asaas)" value={money(s.totalAsaasNetCentavos)} accent />
          <Tile label="Taxa do gateway" value={money(s.totalFeeCentavos)} />
          <Tile
            label="Divergências"
            value={String(s.divergentCount)}
            danger={s.divergentCount > 0}
            hint={s.divergentCount > 0 ? 'Verificar registro!' : 'app = Asaas ✓'}
          />
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>{s.count} cobranças</span>
          <span>· OK: {s.okCount}</span>
          <span>· Estornadas: {s.refundedCount}</span>
          <span>· Aguardando líquido: {s.pendingNetCount}</span>
          <span>· Erros: {s.errorCount}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border-color)]">
              <tr className="text-[var(--text-muted)]">
                <th className="pb-2 pr-3 text-left font-medium">Data</th>
                <th className="pb-2 pr-3 text-left font-medium">Cliente</th>
                <th className="pb-2 pr-3 text-left font-medium">Método</th>
                <th className="pb-2 pr-3 text-left font-medium">Status</th>
                <th className="pb-2 pl-3 text-right font-medium">App (bruto)</th>
                <th className="pb-2 pl-3 text-right font-medium">Asaas (bruto)</th>
                <th className="pb-2 pl-3 text-right font-medium">Líquido</th>
                <th className="pb-2 pl-3 text-right font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {data.items.map((r) => {
                // Fallback defensivo: se o backend introduzir um status não mapeado,
                // degrada para um chip neutro em vez de quebrar a tabela inteira.
                const meta = STATUS_META[r.status] ?? {
                  label: r.status,
                  cls: 'bg-[var(--hover-bg)] text-[var(--text-muted)]',
                };
                return (
                  <tr key={r.paymentId} className="text-[var(--text-secondary)]">
                    <td className="py-2 pr-3 whitespace-nowrap">{r.paidAt ? formatDate(r.paidAt) : '—'}</td>
                    <td className="py-2 pr-3">{r.clientName || '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.billingType || r.method || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs ${meta.cls}`} title={r.errorMessage || ''}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right text-[var(--text-primary)]">{money(r.appAmountCentavos)}</td>
                    <td className={`py-2 pl-3 text-right ${r.divergent ? 'font-semibold text-red-500' : ''}`}>
                      {money(r.asaasValueCentavos)}
                    </td>
                    <td className="py-2 pl-3 text-right">{money(r.asaasNetCentavos)}</td>
                    <td className="py-2 pl-3 text-right">{money(r.feeCentavos)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <PinGate description="Digite o PIN para acessar a conciliação Asaas.">
    <div>
      <h1 className="mb-1 text-2xl font-bold text-[var(--text-primary)]">Conciliação Asaas</h1>
      <p className="mb-6 max-w-3xl text-sm text-[var(--text-muted)]">
        Compara o <strong>bruto cobrado</strong> no app com o que o Asaas registrou: <strong>value</strong> (bruto),{' '}
        <strong>netValue</strong> (líquido, já descontada a taxa) e a <strong>taxa</strong> do gateway. O líquido a menos
        normalmente é só a taxa (PIX ~R$1,99; cartão na liquidação). <strong>Divergente</strong> = app ≠ Asaas → registro a verificar.
      </p>

      <div className="mb-6 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="flex flex-wrap items-end gap-4">
          <DateField label="Data Inicial" value={startDate} onChange={setStartDate} />
          <DateField label="Data Final" value={endDate} onChange={setEndDate} />
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50"
          >
            <BarChart3 className="h-4 w-4" />
            Gerar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">{renderContent()}</div>
    </div>
    </PinGate>
  );
}

function Tile({
  label,
  value,
  accent,
  danger,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${danger ? 'border-red-500/30 bg-red-500/10' : 'border-[var(--border-color)] bg-[var(--hover-bg)]'}`}>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className={`text-2xl font-bold ${danger ? 'text-[#A63030]' : accent ? 'text-[#C8923A]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </p>
      {hint && <p className={`mt-0.5 text-xs ${danger ? 'text-[#C45050]' : 'text-[var(--text-muted)]'}`}>{hint}</p>}
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `concil-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{label}</label>
      <DateInput id={id} value={value} onChange={onChange} />
    </div>
  );
}
