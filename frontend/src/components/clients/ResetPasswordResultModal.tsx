import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MessageCircle, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui';

interface ResetPasswordResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nome do cliente — usado na mensagem do WhatsApp. */
  clientName: string;
  /** Telefone do cliente — quando ausente, esconde o botao de WhatsApp. */
  clientPhone: string | null;
  /** Senha temporaria gerada pelo backend. So fica disponivel uma vez. */
  tempPassword: string;
}

// Mantem o numero limpo (so digitos) e prefixa o codigo do pais quando falta.
// Os telefones aqui sao salvos como (XX) XXXXX-XXXX, sem o +55, entao se vier
// com 10 ou 11 digitos prefixamos. Se ja vier com 12+ (DDI incluso), respeita.
function buildWhatsappUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function ResetPasswordResultModal({
  isOpen,
  onClose,
  clientName,
  clientPhone,
  tempPassword,
}: ResetPasswordResultModalProps) {
  const [copied, setCopied] = useState(false);

  // Limpa o feedback "copiado" toda vez que reabre, pra nao confundir.
  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Em contexto inseguro (HTTP) o clipboard falha — o usuario ainda ve a
      // senha em tela e pode copiar manualmente.
    }
  };

  const firstName = clientName.split(' ')[0] || clientName;
  const whatsappMessage = `Olá ${firstName}! Sua senha de acesso foi resetada. Use esta senha temporária para entrar: ${tempPassword}\n\nNo primeiro login você será solicitado a criar uma nova senha.`;

  const handleSendWhatsapp = () => {
    if (!clientPhone) return;
    window.open(buildWhatsappUrl(clientPhone, whatsappMessage), '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Senha resetada" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-4">
          <KeyRound className="mt-0.5 h-5 w-5 text-emerald-500" />
          <div className="text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-emerald-500">Nova senha gerada</p>
            <p className="mt-1">
              Encaminhe a senha abaixo para <strong>{clientName}</strong>. Ela só será exibida
              agora — depois desta tela só uma nova redefinição cria outra.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Senha temporária
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
            <code className="flex-1 select-all font-mono text-lg font-semibold tracking-widest text-[var(--text-primary)]">
              {tempPassword}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>

        {!clientPhone && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Cliente sem telefone cadastrado — envie a senha por outro canal.</span>
          </div>
        )}

        <div className="flex flex-col-reverse justify-end gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
          >
            Fechar
          </button>
          {clientPhone && (
            <button
              type="button"
              onClick={handleSendWhatsapp}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar no WhatsApp
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
