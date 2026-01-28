import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: 'text-blue-500',
    title: 'text-blue-500',
    message: 'text-blue-400',
  },
  error: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    icon: 'text-red-500',
    title: 'text-red-500',
    message: 'text-red-400',
  },
  warning: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    icon: 'text-red-500',
    title: 'text-red-500',
    message: 'text-red-400',
  },
  info: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    icon: 'text-blue-500',
    title: 'text-blue-500',
    message: 'text-blue-400',
  },
};

function Toast({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(toast.id), 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const Icon = icons[toast.type];
  const style = styles[toast.type];

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-xl border shadow-lg transition-all duration-200 ${
        style.bg
      } ${style.border} ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      role="alert"
    >
      <div className="flex flex-1 items-start gap-3 p-4">
        <Icon className={`h-5 w-5 flex-shrink-0 ${style.icon}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${style.title}`}>{toast.title}</p>
          {toast.message && (
            <p className={`mt-1 text-sm ${style.message}`}>{toast.message}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
