import { useState, useEffect, type ReactNode } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { api } from '@/services/api';

interface PinGateProps {
  children: ReactNode;
  description?: string;
}

export function PinGate({ children, description = 'Digite o PIN para acessar esta página.' }: PinGateProps) {
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setPinRequired(!!data.hasCommissionPin);
    }).catch(() => {
      setPinRequired(false);
    });
  }, []);

  const handleVerifyPin = async () => {
    if (!pinInput) return;
    setVerifyingPin(true);
    setPinError('');
    try {
      const { data } = await api.post('/settings/verify-commission-pin', { pin: pinInput });
      if (data.valid) {
        setPinUnlocked(true);
      } else {
        setPinError('PIN incorreto. Tente novamente.');
        setPinInput('');
      }
    } catch {
      setPinError('Erro ao verificar PIN. Tente novamente.');
    } finally {
      setVerifyingPin(false);
    }
  };

  // Loading
  if (pinRequired === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8923A]" />
      </div>
    );
  }

  // No PIN configured or already unlocked
  if (!pinRequired || pinUnlocked) {
    return <>{children}</>;
  }

  // PIN gate
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C8923A]/20">
          <Lock className="h-8 w-8 text-[#C8923A]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Acesso Restrito</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">{description}</p>

        <input
          type="password"
          maxLength={6}
          placeholder="Digite o PIN"
          value={pinInput}
          onChange={(e) => {
            setPinInput(e.target.value.slice(0, 6));
            setPinError('');
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyPin(); }}
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)] text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-[#C8923A] transition-colors"
        />

        {pinError && (
          <p className="mt-2 text-sm text-[#A63030]">{pinError}</p>
        )}

        <button
          onClick={handleVerifyPin}
          disabled={verifyingPin || pinInput.length < 4}
          className="mt-4 w-full py-3 bg-[#8B6914] hover:bg-[#725510] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {verifyingPin ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <ShieldCheck className="h-5 w-5" />
              Desbloquear
            </>
          )}
        </button>
      </div>
    </div>
  );
}
