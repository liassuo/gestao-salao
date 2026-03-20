import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'ios-install-banner-dismissed';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  return ('standalone' in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
}

export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS()) return;
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    // Mostrar após 3 segundos para não atrapalhar o carregamento
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      {/* Seta apontando para baixo (onde fica o botão compartilhar no Safari) */}
      <div className="mx-4 mb-4 rounded-2xl border border-[#C8923A]/30 bg-[#1E1610] p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* Ícone do app */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <img
              src="/favicon/web-app-manifest-192x192.png"
              alt=""
              className="h-8 w-8 rounded-lg"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F2E8D5]">
              Instalar Barbearia America
            </p>
            <p className="mt-1 text-xs text-[#8B7D6B] leading-relaxed">
              Toque em{' '}
              <span className="inline-flex items-center gap-0.5">
                <ShareIcon />
                <span className="font-medium text-[#C8923A]">Compartilhar</span>
              </span>
              {' '}e depois em{' '}
              <span className="font-medium text-[#C8923A]">"Adicionar a Tela de Início"</span>
            </p>
          </div>

          <button
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-[#8B7D6B] hover:text-[#F2E8D5] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Seta visual apontando para o botão de compartilhar (bottom center no Safari) */}
        <div className="mt-3 flex justify-center">
          <svg className="h-6 w-6 text-[#C8923A] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** Ícone de compartilhar do iOS (quadrado com seta pra cima) */
function ShareIcon() {
  return (
    <svg className="inline h-4 w-4 text-[#C8923A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}
