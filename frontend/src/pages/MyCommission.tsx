import { useEffect, useMemo, useState } from 'react';
import { commissionsService } from '@/services/commissions';
import { formatCurrency } from '@/utils/format';
import type { Commission } from '@/types';

// Tela do BARBEIRO: vê só a própria comissão (o backend força o professionalId do
// token em /commissions/me). Mostra o mês atual por padrão, com total a receber.
function monthRange(ref: Date) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${y}-${pad(m + 1)}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${pad(m + 1)}-${pad(last)}`;
  return { start, end };
}

export function MyCommission() {
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = mês atual

  const ref = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const { start, end } = monthRange(ref);
    commissionsService
      .listMine({ startDate: start, endDate: end })
      .then((data) => { if (alive) setItems(data); })
      .catch(() => { if (alive) setError('Não foi possível carregar sua comissão.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ref]);

  const totalReceber = items.reduce((s, c) => {
    const liquido = c.amount - (c.amountDeductedDebts || 0);
    return s + liquido;
  }, 0);
  const totalPago = items.filter((c) => c.status === 'PAID').reduce((s, c) => s + (c.amount - (c.amountDeductedDebts || 0)), 0);
  const totalPendente = totalReceber - totalPago;

  const mesLabel = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Minha Comissão</h1>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded bg-[var(--surface,#222)]" onClick={() => setMonthOffset((o) => o - 1)}>◀</button>
          <span className="capitalize min-w-[140px] text-center">{mesLabel}</span>
          <button className="px-3 py-1 rounded bg-[var(--surface,#222)] disabled:opacity-40" disabled={monthOffset >= 0} onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}>▶</button>
        </div>
      </div>

      {loading && <p className="text-[var(--text-muted)]">Carregando…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg p-4 bg-[var(--surface,#1a1a1a)]">
              <p className="text-xs text-[var(--text-muted)]">Total a receber no mês</p>
              <p className="text-3xl font-extrabold text-green-400">{formatCurrency(totalReceber)}</p>
            </div>
            <div className="rounded-lg p-4 bg-[var(--surface,#1a1a1a)]">
              <p className="text-xs text-[var(--text-muted)]">Pendente / Já pago</p>
              <p className="text-lg font-semibold">{formatCurrency(totalPendente)} <span className="text-[var(--text-muted)] text-sm">pendente</span></p>
              <p className="text-sm text-[var(--text-muted)]">{formatCurrency(totalPago)} já pago</p>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-[var(--text-muted)]">Nenhuma comissão registrada neste mês.</p>
          ) : (
            <div className="rounded-lg overflow-hidden border border-[var(--border,#333)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface,#1a1a1a)] text-[var(--text-muted)]">
                  <tr>
                    <th className="text-left p-3">Período</th>
                    <th className="text-right p-3">Valor</th>
                    <th className="text-right p-3">Descontos</th>
                    <th className="text-right p-3">A receber</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => {
                    const liquido = c.amount - (c.amountDeductedDebts || 0);
                    return (
                      <tr key={c.id} className="border-t border-[var(--border,#333)]">
                        <td className="p-3">{c.periodStart.slice(0, 10)} a {c.periodEnd.slice(0, 10)}</td>
                        <td className="p-3 text-right">{formatCurrency(c.amount)}</td>
                        <td className="p-3 text-right text-red-400">{c.amountDeductedDebts ? '- ' + formatCurrency(c.amountDeductedDebts) : '—'}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(liquido)}</td>
                        <td className="p-3 text-center">
                          <span className={c.status === 'PAID' ? 'text-green-400' : 'text-yellow-400'}>
                            {c.status === 'PAID' ? 'Pago' : 'A receber'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
