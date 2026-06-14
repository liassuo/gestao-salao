import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

// Input de data que SEMPRE exibe no padrão BR (dd/mm/aaaa), independente do
// locale do navegador/SO. O <input type="date"> nativo formata conforme o idioma
// do navegador (em en-US vira mm/dd/aaaa) e isso não é controlável via página —
// nem o `lang="pt-BR"` resolve. Aqui o usuário vê/digita dd/mm/aaaa, mas o valor
// trafegado continua ISO (yyyy-mm-dd), igual ao input nativo. O calendário usa um
// input nativo escondido só para o seletor.

function isoToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function brToIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Rejeita datas impossíveis (ex.: 31/02): reconstrói e confere.
  const dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
  if (Number.isNaN(dt.getTime()) || dt.getMonth() + 1 !== month || dt.getDate() !== day) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function maskBr(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '/' + d.slice(2, 4);
  if (d.length > 4) out += '/' + d.slice(4, 8);
  return out;
}

const BASE_CLASS =
  'rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none';

export function DateInput({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
}) {
  const [text, setText] = useState(() => isoToBr(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  // Mantém o texto exibido em sincronia com o value externo (atalhos de período,
  // reset, etc.).
  useEffect(() => {
    setText(isoToBr(value));
  }, [value]);

  const handleText = (raw: string) => {
    const masked = maskBr(raw);
    setText(masked);
    if (masked === '') {
      onChange('');
      return;
    }
    const iso = brToIso(masked);
    if (iso) onChange(iso);
  };

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        aria-label="Abrir calendário"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => setText(isoToBr(value))}
        className={className ?? BASE_CLASS}
      />
      {/* Input nativo escondido — usado só para abrir o calendário. Valor em ISO. */}
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-full w-10 opacity-0"
      />
    </div>
  );
}
