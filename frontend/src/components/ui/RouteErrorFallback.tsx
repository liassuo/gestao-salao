import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Tela de erro amigável para as rotas (errorElement do React Router).
 *
 * Sem isto, QUALQUER erro de renderização em QUALQUER página derrubava o app
 * inteiro na tela preta padrão do React Router ("Unexpected Application
 * Error!") — foi o modo de falha do incidente do caixa de 13-14/07/2026.
 * Com o errorElement, o erro fica contido: quando montado abaixo do Layout,
 * só a área da página quebra (menu continua navegável); no nível raiz, o
 * usuário ainda ganha uma tela em português com saída (recarregar / início).
 */
export function RouteErrorFallback({ homePath = '/' }: { homePath?: string }) {
  const error = useRouteError();

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error ?? 'Erro desconhecido');

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-[#A63030]" />
        </div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">
          Algo deu errado nesta tela
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Ocorreu um erro inesperado ao exibir esta página. Seus dados estão
          seguros — tente recarregar ou volte para o início.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#C8923A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            Recarregar página
          </button>
          <Link
            to={homePath}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-bg)]"
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </Link>
        </div>
        <p className="mt-6 break-words text-xs text-[var(--text-muted)]">
          Detalhe técnico: {detail}
        </p>
      </div>
    </div>
  );
}
