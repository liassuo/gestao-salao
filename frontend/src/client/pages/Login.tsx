import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { Mail, Lock, LogIn, UserPlus, User, Phone } from 'lucide-react';
import { useClientAuth } from '../auth';

export function ClientLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, loginWithGoogle, register } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/cliente';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register') {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setError('Preencha todos os campos obrigatorios');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        await register(name.trim(), email.trim(), password, phone.trim() || undefined);
        navigate(from, { replace: true });
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Erro ao criar conta. Tente novamente.';
        setError(msg);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await login(email.trim(), password);
      if (result.mustChangePassword) {
        navigate('/cliente/criar-senha', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError('Email ou senha incorretos. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError(null);
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Erro ao fazer login com Google. Tente novamente.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await loginWithGoogle(credentialResponse.credential);
      navigate(from, { replace: true });
    } catch (err) {
      setError('Erro ao fazer login com Google. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleError = () => {
    setError('Erro ao conectar com Google. Tente novamente.');
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
              {mode === 'register' ? 'Criar Conta' : 'Portal do Cliente'}
            </p>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#8B2020]/40 bg-[#8B2020]/10 p-4 text-sm text-[#C45050]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8B2020]/20">
                <span className="text-base">!</span>
              </div>
              {error}
            </div>
          )}

          {/* Google Login Button */}
          <div className="mb-6">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              size="large"
              width="100%"
              text="continue_with"
              shape="rectangular"
            />
          </div>

          {/* Divisor */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-[#3D2B1F] to-transparent"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#1E1610] text-[#8B7D6B]">
                ou continue com email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome (só no registro) */}
            {mode === 'register' && (
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-[#D4C4A0]">
                  Nome *
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 focus:border-[#C8923A]/50 hover:border-[#5C4530] disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-[#D4C4A0]">
                Email {mode === 'register' && '*'}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 focus:border-[#C8923A]/50 hover:border-[#5C4530] disabled:opacity-60"
                />
              </div>
            </div>

            {/* Telefone (só no registro) */}
            {mode === 'register' && (
              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium text-[#D4C4A0]">
                  Telefone
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <Phone className="h-5 w-5" />
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 focus:border-[#C8923A]/50 hover:border-[#5C4530] disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            {/* Senha */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#D4C4A0]">
                Senha {mode === 'register' && '* (min. 6 caracteres)'}
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
                  placeholder="Sua senha"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 focus:border-[#C8923A]/50 hover:border-[#5C4530] disabled:opacity-60"
                />
              </div>
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
                  <span>{mode === 'register' ? 'Criando conta...' : 'Entrando...'}</span>
                </>
              ) : (
                <>
                  {mode === 'register' ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                  <span>{mode === 'register' ? 'Criar Conta' : 'Entrar'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle login/register */}
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-sm text-[#C8923A] hover:text-[#D4A85C] transition-colors"
            >
              {mode === 'login'
                ? 'Nao tem conta? Criar conta'
                : 'Ja tem conta? Fazer login'}
            </button>
          </div>

          {/* Divisor decorativo */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#3D2B1F] to-transparent" />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-[#C8923A]/60">BARBEARIA AMERICA</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#3D2B1F] to-transparent" />
          </div>

          <p className="text-center text-xs text-[#6B5D4F]">
            Agende seus horarios e acompanhe seus atendimentos
          </p>
        </div>
      </div>
    </div>
  );
}
