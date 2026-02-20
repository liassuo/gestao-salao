import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/auth';
import type { LoginCredentials } from '@/auth';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string })?.from || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>();

  const onSubmit = async (data: LoginCredentials) => {
    setError(null);

    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        setError('Credenciais inválidas. Verifique seu email e senha.');
      }
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" style={{ background: 'linear-gradient(145deg, #1A1008 0%, #231710 40%, #1E130A 70%, #15100A 100%)' }}>
      {/* Background decorativo */}
      <div className="pointer-events-none absolute inset-0">
        {/* Gradientes quentes */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#8B2020]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#C8923A]/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1B2A4A]/10 blur-[100px]" />

        {/* Textura de couro / madeira envelhecida */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #C8923A 1px, transparent 1px),
            radial-gradient(circle at 75% 75%, #8B7355 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />

        {/* Vinheta escura nas bordas */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10, 7, 3, 0.6) 100%)'
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card principal - estilo couro/madeira */}
        <div className="relative rounded-2xl border border-[#3D2B1F] bg-[#1E1610]/90 p-8 shadow-2xl backdrop-blur-sm">
          {/* Borda dourada sutil no topo */}
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8923A]/40 to-transparent" />
          {/* Borda dourada sutil na base */}
          <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8923A]/20 to-transparent" />

          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="relative inline-block">
              <div className="absolute -inset-6 rounded-full bg-[#C8923A]/8 blur-2xl" />
              <img
                src="/barbearia-america.png"
                alt="Barbearia América"
                className="relative mx-auto h-32 w-auto drop-shadow-2xl"
              />
            </div>
            <p className="mt-6 text-sm font-medium tracking-widest uppercase text-[#8B7D6B]">
              Painel Administrativo
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Mensagem de erro */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-[#8B2020]/40 bg-[#8B2020]/10 p-4 text-sm text-[#C45050]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8B2020]/20">
                  <span className="text-base">!</span>
                </div>
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#D4C4A0]"
              >
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className={`w-full rounded-xl border bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 ${
                    errors.email
                      ? 'border-[#8B2020]/60 focus:border-[#8B2020]'
                      : 'border-[#3D2B1F] hover:border-[#5C4530] focus:border-[#C8923A]/50'
                  }`}
                  {...register('email', {
                    required: 'Email é obrigatório',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido',
                    },
                  })}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-[#C45050]">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#D4C4A0]"
              >
                Senha
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  className={`w-full rounded-xl border bg-[#15100A] py-3.5 pl-12 pr-12 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 ${
                    errors.password
                      ? 'border-[#8B2020]/60 focus:border-[#8B2020]'
                      : 'border-[#3D2B1F] hover:border-[#5C4530] focus:border-[#C8923A]/50'
                  }`}
                  {...register('password', {
                    required: 'Senha é obrigatória',
                    minLength: {
                      value: 6,
                      message: 'Senha deve ter no mínimo 6 caracteres',
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B7D6B] transition-colors hover:text-[#D4C4A0]"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-[#C45050]">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Botão de submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#8B2020] to-[#A63030] px-4 py-3.5 font-semibold text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30 transition-all duration-300 hover:from-[#A63030] hover:to-[#8B2020] hover:shadow-[#8B2020]/50 focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[#1E1610] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {/* Brilho no hover */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />

              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#F2E8D5] border-t-transparent" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Entrar</span>
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

          {/* Info adicional */}
          <p className="text-center text-xs text-[#6B5D4F]">
            Sistema exclusivo para funcionarios autorizados
          </p>
        </div>

      </div>
    </div>
  );
}
