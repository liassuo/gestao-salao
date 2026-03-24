import { useState } from 'react';
import { X, Copy, Check, QrCode, AlertCircle } from 'lucide-react';
import { useToast } from './ToastContext';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixData: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null;
  amount: number;
  description?: string;
}

export function PixPaymentModal({
  isOpen,
  onClose,
  pixData,
  amount,
  description,
}: PixPaymentModalProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !pixData) return null;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(pixData.payload);
    setCopied(true);
    toast.success('Copiado!', 'Código PIX copiado para a área de transferência.');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#C8923A]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Pagamento PIX
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className="mb-6">
            <p className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-1">
              Valor a pagar
            </p>
            <p className="text-3xl font-extrabold text-[var(--text-primary)]">
              {formatCurrency(amount)}
            </p>
            {description && (
              <p className="text-sm text-[var(--text-muted)] mt-2 italic px-4">
                {description}
              </p>
            )}
          </div>

          {/* QR Code */}
          <div className="mb-6 flex flex-col items-center">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#C8923A] to-[#8B6914] rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white p-3 rounded-xl shadow-inner">
                <img
                  src={`data:image/png;base64,${pixData.encodedImage}`}
                  alt="QR Code PIX"
                  className="h-48 w-48"
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-[var(--text-muted)] max-w-[200px]">
              Abra o app do seu banco e escaneie o código acima
            </p>
          </div>

          {/* Copy and Paste */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--text-secondary)] text-left">
              Ou copie o código PIX:
            </p>
            <div className="relative group">
              <div className="absolute inset-0 bg-[#C8923A]/10 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-1 pr-1 pl-3 transition-colors group-hover:border-[#C8923A]/50">
                <p className="flex-1 truncate text-xs text-[var(--text-muted)] font-mono text-left">
                  {pixData.payload}
                </p>
                <button
                  onClick={handleCopyPayload}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C8923A]/10 text-[#C8923A] hover:bg-[#C8923A] hover:text-white transition-all active:scale-95"
                  title="Copiar código PIX"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[var(--hover-bg)] px-6 py-4 flex flex-col gap-3 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] justify-center">
            <AlertCircle className="h-3.5 w-3.5 text-[#C8923A]" />
            <span>O pagamento será confirmado automaticamente</span>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-[#8B6914] py-3 text-sm font-bold text-white shadow-lg shadow-[#8B6914]/20 hover:bg-[#725510] hover:shadow-[#8B6914]/40 transition-all active:transform active:scale-[0.98]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
