import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { clientAuthApi } from '../services/api';
import { CLIENT_PATHS } from '../utils/paths';
import { BrandWordmark } from '../components';

export function ClientForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await clientAuthApi.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError('Erro ao enviar email. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" style={{ background: 'linear-gradient(145deg, #1A1008 0%, #231710 40%, #1E130A 70%, #15100A 100%)' }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#8B2020]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#C8923A]/10 blur-[120px]" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10, 7, 3, 0.6) 100%)' }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="relative rounded-2xl border border-[#3D2B1F] bg-[#1E1610]/90 p-8 shadow-2xl backdrop-blur-sm">
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8923A]/40 to-transparent" />
          <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8923A]/20 to-transparent" />

          <div className="mb-8 text-center">
            <div className="relative inline-block">
              <div className="absolute -inset-6 rounded-full bg-[#C8923A]/8 blur-2xl" />
              <BrandWordmark size="lg" className="relative" />
            </div>
            <p className="mt-5 text-sm font-medium tracking-widest uppercase text-[#8B7D6B]">
              Recuperar Senha
            </p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <p className="mb-2 font-semibold text-[#D4C4A0]">Email enviado!</p>
              <p className="mb-6 text-sm text-[#8B7D6B]">
                Se esse email estiver cadastrado, você receberá as instruções para redefinir sua senha em breve. Verifique sua caixa de entrada (e spam).
              </p>
              <Link to={CLIENT_PATHS.login} className="text-sm text-[#C8923A] hover:text-[#D4A85C] transition-colors">
                ← Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-[#8B7D6B]">
                Digite seu email e enviaremos um link para redefinir sua senha.
              </p>

              {error && (
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#8B2020]/40 bg-[#8B2020]/10 p-4 text-sm text-[#C45050]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8B2020]/20">
                    <span className="text-base">!</span>
                  </div>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-[#D4C4A0]">Email</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                      <Mail className="h-5 w-5" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoFocus
                      className="w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 hover:border-[#5C4530] focus:border-[#C8923A]/50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#8B2020] to-[#A63030] px-4 py-3.5 font-semibold text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30 transition-all duration-300 hover:from-[#A63030] hover:to-[#8B2020] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[#1E1610] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  {isSubmitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#F2E8D5] border-t-transparent" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar Link de Recuperação</span>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to={CLIENT_PATHS.login} className="inline-flex items-center gap-1.5 text-sm text-[#8B7D6B] hover:text-[#D4C4A0] transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
