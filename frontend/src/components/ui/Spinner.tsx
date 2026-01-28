interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'red' | 'white';
  className?: string;
}

const sizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-3',
  lg: 'h-12 w-12 border-4',
};

const colors = {
  blue: 'border-blue-600 border-t-transparent',
  red: 'border-red-600 border-t-transparent',
  white: 'border-white border-t-transparent',
};

export function Spinner({ size = 'md', color = 'blue', className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full ${sizes[size]} ${colors[color]} ${className}`}
      role="status"
      aria-label="Carregando"
    >
      <span className="sr-only">Carregando...</span>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Carregando...' }: LoadingOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-12">
      <Spinner size="lg" />
      <p className="mt-4 text-[var(--text-muted)]">{message}</p>
    </div>
  );
}
