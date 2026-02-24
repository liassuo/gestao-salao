interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingState({ message = 'Carregando...', fullScreen = false }: LoadingStateProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C8923A] mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8923A] mb-3"></div>
      <p className="text-[var(--text-muted)] text-sm">{message}</p>
    </div>
  );
}
