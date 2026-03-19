import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { useClientAuth } from '../auth';

export function ClientSetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setupPassword, user } = useClientAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim() || !confirmPassword.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await setupPassword(password);
      navigate('/cliente', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao definir senha. Tente novamente.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" style={{ background: 'linear-gradient(145deg, #1A1008 0%, #231710 40%, #1E130A 70%, #15100A 100%)' }}>
      {/* Background decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#8B2020]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#C8923A]/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1B2A4A]/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #C8923A 1px, transparent 1px),
            radial-gradient(circle at 75% 75%, #8B7355 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10, 7, 3, 0.6) 100%)'
        }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="relative rounded-2xl border border-[#3D2B1F] bg-[#1E1610]/90 p-8 shadow-2xl backdrop-blur-sm">
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8923A]/40 to-transparent" />
          <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8923A]/20 to-transparent" />

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="relative inline-block">
              <div className="absolute -inset-6 rounded-full bg-[#C8923A]/8 blur-2xl" />
              <div className="relative flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-gradient-to-br from-[#C8923A] to-[#8B6914] shadow-lg shadow-[#C8923A]/20">
                <ShieldCheck className="h-10 w-10 text-white" />
              </div>
            </div>
            <h2 className="mt-6 text-xl font-bold text-[#F2E8D5]">
              Bem-vindo, {user?.name?.split(' ')[0] || 'Cliente'}!
            </h2>
            <p className="mt-2 text-sm text-[#8B7D6B]">
              Este e seu primeiro acesso. Crie uma senha para sua conta.
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#8B2020]/40 bg-[#8B2020]/10 p-4 text-sm text-[#C45050]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8B2020]/20">
                <span className="text-base">!</span>
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nova Senha */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#D4C4A0]">
                Nova Senha * (min. 6 caracteres)
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crie sua senha"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 focus:border-[#C8923A]/50 hover:border-[#5C4530] disabled:opacity-60"
                />
              </div>
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#D4C4A0]">
                Confirmar Senha *
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua senha"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 focus:border-[#C8923A]/50 hover:border-[#5C4530] disabled:opacity-60"
                />
              </div>
            </div>

            {/* Botao */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#8B2020] to-[#A63030] px-4 py-3.5 font-semibold text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30 transition-all duration-300 hover:from-[#A63030] hover:to-[#8B2020] hover:shadow-[#8B2020]/50 focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[#1E1610] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#F2E8D5] border-t-transparent" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  <span>Definir Senha e Entrar</span>
                </>
              )}
            </button>
          </form>

          {/* Divisor decorativo */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#3D2B1F] to-transparent" />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-[#C8923A]/60">BARBEARIA AMERICA</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#3D2B1F] to-transparent" />
          </div>

          <p className="text-center text-xs text-[#6B5D4F]">
            Apos criar sua senha, voce podera acessar o portal normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}
