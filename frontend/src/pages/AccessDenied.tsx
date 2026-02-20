import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

export function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
          <ShieldX className="h-10 w-10 text-[#A63030]" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
          Acesso Negado
        </h1>
        <p className="mb-6 text-[var(--text-muted)]">
          Você não tem permissão para acessar esta página.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-xl bg-[#8B2020] px-6 py-3 font-medium text-white transition-colors hover:bg-[#6B1818]"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
