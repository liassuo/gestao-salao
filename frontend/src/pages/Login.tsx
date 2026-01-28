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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-4 transition-colors duration-200">
      {/* Background decorativo */}
      <div className="pointer-events-none absolute inset-0">
        {/* Gradientes coloridos */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[100px]" />

        {/* Padrão de linhas decorativas */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            currentColor 0px,
            currentColor 1px,
            transparent 1px,
            transparent 60px
          ),
          repeating-linear-gradient(
            0deg,
            currentColor 0px,
            currentColor 1px,
            transparent 1px,
            transparent 60px
          )`
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card principal */}
        <div className="relative rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 shadow-2xl backdrop-blur-xl transition-colors duration-200">
          {/* Borda gradiente sutil no topo */}
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="relative inline-block">
              <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-red-500/20 to-blue-500/20 blur-xl" />
              <img
                src="/barbearia-america.png"
                alt="Barbearia América"
                className="relative mx-auto h-28 w-auto drop-shadow-2xl"
              />
            </div>
            <p className="mt-6 text-sm font-medium tracking-wide text-[var(--text-muted)]">
              Acesse o painel administrativo
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Mensagem de erro */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                  <span className="text-base">!</span>
                </div>
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--text-secondary)]"
              >
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className={`w-full rounded-xl border bg-[var(--hover-bg)] py-3.5 pl-12 pr-4 text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                    errors.email
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[var(--border-color)] hover:border-[var(--text-muted)] focus:border-red-500/50'
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
                <p className="text-sm text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--text-secondary)]"
              >
                Senha
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  className={`w-full rounded-xl border bg-[var(--hover-bg)] py-3.5 pl-12 pr-12 text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                    errors.password
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[var(--border-color)] hover:border-[var(--text-muted)] focus:border-red-500/50'
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Botão de submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-red-500/25 transition-all duration-300 hover:from-red-500 hover:to-red-600 hover:shadow-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {/* Brilho no hover */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />

              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
            <span className="text-xs font-medium text-[var(--text-muted)]">BARBEARIA AMÉRICA</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
          </div>

          {/* Info adicional */}
          <p className="text-center text-xs text-[var(--text-muted)]">
            Sistema exclusivo para funcionários autorizados
          </p>
        </div>

      </div>
    </div>
  );
}
