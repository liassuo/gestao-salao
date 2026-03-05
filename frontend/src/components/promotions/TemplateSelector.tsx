import { Tag, Copy } from 'lucide-react';
import { usePromotionTemplates } from '@/hooks';
import type { Promotion } from '@/types';

interface TemplateSelectorProps {
  onSelect: (template: Promotion) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const { data: templates, isLoading } = usePromotionTemplates();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--hover-bg)]" />
        ))}
      </div>
    );
  }

  if (!templates?.length) {
    return (
      <div className="py-8 text-center">
        <Tag className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">Nenhum template salvo ainda.</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Crie uma promocao e marque como template para reutilizar.
        </p>
        <button
          onClick={onClose}
          className="mt-4 rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
        >
          Criar do zero
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--text-muted)] mb-3">
        Selecione um template para iniciar a promocao:
      </p>
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          onClick={() => onSelect(tpl)}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 text-left transition-colors hover:border-[#C8923A]/50 hover:bg-[var(--hover-bg)]"
        >
          {tpl.bannerImageUrl ? (
            <img src={tpl.bannerImageUrl} alt={tpl.name} className="h-12 w-16 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-[#C8923A]/20">
              <Tag className="h-5 w-5 text-[#C8923A]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--text-primary)] truncate">{tpl.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {tpl.discountPercent}% off - {tpl.services.length} servico(s)
            </p>
          </div>
          <Copy className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
        </button>
      ))}
      <button
        onClick={onClose}
        className="mt-3 w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
      >
        Criar do zero
      </button>
    </div>
  );
}
