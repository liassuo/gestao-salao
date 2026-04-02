interface PeriodShortcutsProps {
  onSelect: (startDate: string, endDate: string) => void;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PeriodShortcuts({ onSelect }: PeriodShortcutsProps) {
  const today = new Date();

  const shortcuts = [
    {
      label: 'Hoje',
      get: () => {
        const d = fmt(today);
        return [d, d];
      },
    },
    {
      label: 'Semana atual',
      get: () => {
        const day = today.getDay();
        const start = new Date(today);
        start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return [fmt(start), fmt(end)];
      },
    },
    {
      label: 'Semana passada',
      get: () => {
        const day = today.getDay();
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const start = new Date(thisMonday);
        start.setDate(thisMonday.getDate() - 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return [fmt(start), fmt(end)];
      },
    },
    {
      label: 'Mês atual',
      get: () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return [fmt(start), fmt(end)];
      },
    },
    {
      label: 'Mês passado',
      get: () => {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return [fmt(start), fmt(end)];
      },
    },
    {
      label: 'Últimos 15 dias',
      get: () => {
        const start = new Date(today);
        start.setDate(today.getDate() - 14);
        return [fmt(start), fmt(today)];
      },
    },
    {
      label: 'Últimos 30 dias',
      get: () => {
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
        return [fmt(start), fmt(today)];
      },
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {shortcuts.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => {
            const [start, end] = s.get();
            onSelect(start, end);
          }}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[#C8923A]/50 hover:text-[#C8923A]"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
