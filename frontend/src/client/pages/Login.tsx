import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { Mail, Lock, ArrowRight, ArrowLeft, User, Phone, CalendarDays } from 'lucide-react';
import { useClientAuth } from '../auth';
import { clientAuthApi } from '../services/api';
import type { CheckEmailResponse } from '../services/api';

type Step = 'email' | 'login' | 'register' | 'setup_password';

export function ClientLogin() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, loginWithGoogle, register, setupPassword } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/cliente';

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 6) return 'A senha deve ter pelo menos 6 caracteres';
    if (!/\d/.test(pw)) return 'A senha deve conter pelo menos um numero';
    return null;
  };

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Digite seu email');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result: CheckEmailResponse = await clientAuthApi.checkEmail(email.trim());

      switch (result.status) {
        case 'new':
          setStep('register');
          break;
        case 'login':
          setClientName(result.name || '');
          setStep('login');
          break;
        case 'setup_password':
          setClientName(result.name || '');
          setStep('setup_password');
          break;
        case 'google':
          setError(`Esta conta usa login com Google. Use o botao "Continuar com Google" acima.`);
          break;
      }
    } catch {
      setError('Erro ao verificar email. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Digite sua senha');
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
    } catch {
      setError('Senha incorreta. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Digite seu nome');
      return;
    }

    if (!phone.trim()) {
      setError('Digite seu telefone');
      return;
    }

    if (!birthDate) {
      setError('Informe sua data de nascimento');
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await register(name.trim(), email.trim(), password, phone.trim(), birthDate || undefined);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao criar conta. Tente novamente.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Fazer login primeiro (sem senha, o backend retorna mustChangePassword)
      await login(email.trim(), 'temp');
      // Agora definir a senha
      await setupPassword(password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao definir senha. Tente novamente.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
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
    } catch {
      setError('Erro ao fazer login com Google. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  const getStepTitle = () => {
    switch (step) {
      case 'email': return 'Portal do Cliente';
      case 'login': return `Ola, ${clientName.split(' ')[0]}!`;
      case 'register': return 'Criar Conta';
      case 'setup_password': return `Bem-vindo, ${clientName.split(' ')[0]}!`;
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'email': return null;
      case 'login': return 'Digite sua senha para entrar';
      case 'register': return 'Preencha seus dados para criar sua conta';
      case 'setup_password': return 'Crie uma senha para acessar sua conta';
    }
  };

  const inputClass = "w-full rounded-xl border border-[#3D2B1F] bg-[#15100A] py-3.5 pl-12 pr-4 text-[#F2E8D5] placeholder-[#6B5D4F] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8923A]/50 focus:border-[#C8923A]/50 hover:border-[#5C4530] disabled:opacity-60";

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

          {/* Logo */}
          <div className="mb-6 text-center">
            <div className="relative inline-block">
              <div className="absolute -inset-6 rounded-full bg-[#C8923A]/8 blur-2xl" />
              <img
                src="/barbearia-america.png"
                alt="Barbearia America"
                className="relative mx-auto h-28 w-auto drop-shadow-2xl"
              />
            </div>
            <p className="mt-5 text-sm font-medium tracking-widest uppercase text-[#8B7D6B]">
              {getStepTitle()}
            </p>
            {getStepSubtitle() && (
              <p className="mt-1 text-xs text-[#6B5D4F]">{getStepSubtitle()}</p>
            )}
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

          {/* Google Login - só na etapa de email */}
          {step === 'email' && (
            <>
              <div className="mb-5">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Erro ao conectar com Google.')}
                  size="large"
                  width={400}
                  text="continue_with"
                  shape="rectangular"
                />
              </div>
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-[#3D2B1F] to-transparent"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#1E1610] text-[#8B7D6B]">ou continue com email</span>
                </div>
              </div>
            </>
          )}

          {/* === ETAPA 1: EMAIL === */}
          {step === 'email' && (
            <form onSubmit={handleCheckEmail}>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-[#D4C4A0]">
                  Email
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
                    autoFocus
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !email.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#8B2020] to-[#A63030] text-[#F2E8D5] transition-all hover:from-[#A63030] hover:to-[#8B2020] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#F2E8D5] border-t-transparent" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* === ETAPA 2A: LOGIN (email existente com senha) === */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email (readonly) */}
              <div className="flex items-center gap-2 rounded-xl border border-[#3D2B1F]/50 bg-[#15100A]/50 px-4 py-2.5 text-sm text-[#8B7D6B]">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{email}</span>
                <button type="button" onClick={handleBack} className="ml-auto shrink-0 text-[#C8923A] hover:text-[#D4A85C] transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-[#D4C4A0]">
                  Senha
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
                    autoFocus
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#8B2020] to-[#A63030] px-4 py-3.5 font-semibold text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30 transition-all duration-300 hover:from-[#A63030] hover:to-[#8B2020] hover:shadow-[#8B2020]/50 focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[#1E1610] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                {isSubmitting ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#F2E8D5] border-t-transparent" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <span>Entrar</span>
                )}
              </button>
            </form>
          )}

          {/* === ETAPA 2B: REGISTRO (email novo) === */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Email (readonly) */}
              <div className="flex items-center gap-2 rounded-xl border border-[#3D2B1F]/50 bg-[#15100A]/50 px-4 py-2.5 text-sm text-[#8B7D6B]">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{email}</span>
                <button type="button" onClick={handleBack} className="ml-auto shrink-0 text-[#C8923A] hover:text-[#D4A85C] transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-[#D4C4A0]">Nome *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <User className="h-5 w-5" />
                  </div>
                  <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" disabled={isSubmitting} autoFocus className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium text-[#D4C4A0]">Telefone *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <Phone className="h-5 w-5" />
                  </div>
                  <input type="tel" id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" disabled={isSubmitting} className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="birthDate" className="block text-sm font-medium text-[#D4C4A0]">Data de Nascimento *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <input type="date" id="birthDate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} disabled={isSubmitting} className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-password" className="block text-sm font-medium text-[#D4C4A0]">
                  Senha * <span className="text-xs text-[#6B5D4F]">(min. 6 caracteres, pelo menos 1 numero)</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input type="password" id="reg-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie sua senha" disabled={isSubmitting} className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-confirm" className="block text-sm font-medium text-[#D4C4A0]">Confirmar Senha *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input type="password" id="reg-confirm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirme sua senha" disabled={isSubmitting} className={inputClass} />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#8B2020] to-[#A63030] px-4 py-3.5 font-semibold text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30 transition-all duration-300 hover:from-[#A63030] hover:to-[#8B2020] hover:shadow-[#8B2020]/50 focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[#1E1610] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                {isSubmitting ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#F2E8D5] border-t-transparent" />
                    <span>Criando conta...</span>
                  </>
                ) : (
                  <span>Criar Conta</span>
                )}
              </button>
            </form>
          )}

          {/* === ETAPA 2C: SETUP PASSWORD (email existente sem senha) === */}
          {step === 'setup_password' && (
            <form onSubmit={handleSetupPassword} className="space-y-4">
              {/* Email (readonly) */}
              <div className="flex items-center gap-2 rounded-xl border border-[#3D2B1F]/50 bg-[#15100A]/50 px-4 py-2.5 text-sm text-[#8B7D6B]">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{email}</span>
                <button type="button" onClick={handleBack} className="ml-auto shrink-0 text-[#C8923A] hover:text-[#D4A85C] transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label htmlFor="setup-password" className="block text-sm font-medium text-[#D4C4A0]">
                  Nova Senha * <span className="text-xs text-[#6B5D4F]">(min. 6 caracteres, pelo menos 1 numero)</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input type="password" id="setup-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie sua senha" disabled={isSubmitting} autoFocus className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="setup-confirm" className="block text-sm font-medium text-[#D4C4A0]">Confirmar Senha *</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7D6B]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input type="password" id="setup-confirm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirme sua senha" disabled={isSubmitting} className={inputClass} />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#8B2020] to-[#A63030] px-4 py-3.5 font-semibold text-[#F2E8D5] shadow-lg shadow-[#8B2020]/30 transition-all duration-300 hover:from-[#A63030] hover:to-[#8B2020] hover:shadow-[#8B2020]/50 focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[#1E1610] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                {isSubmitting ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#F2E8D5] border-t-transparent" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Definir Senha e Entrar</span>
                )}
              </button>
            </form>
          )}

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
