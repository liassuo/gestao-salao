import { useState, useEffect } from 'react';
import { Save, Building2, Clock, Bell, Shield, Palette, Sun, Moon, Monitor, MessageCircle, Loader2, Check } from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { formatPhoneInput } from '@/utils/format';

function formatWhatsAppInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 2) return `+${digits}`;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

function formatWhatsAppDisplay(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  return formatWhatsAppInput(digits);
}

interface BusinessSettings {
  businessName: string;
  phone: string;
  whatsapp: string;
  address: string;
  openingTime: string;
  closingTime: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  appointmentReminders: boolean;
  reminderHoursBefore: number;
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'light' as const, label: 'Claro', icon: Sun, preview: 'bg-white border border-zinc-200' },
    { id: 'dark' as const, label: 'Escuro', icon: Moon, preview: 'bg-zinc-900' },
    { id: 'system' as const, label: 'Sistema', icon: Monitor, preview: 'bg-gradient-to-r from-white to-zinc-900' },
  ];

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
      <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Configurações de Aparência</h2>

      <div className="space-y-6">
        <div>
          <h3 className="mb-4 font-medium text-[var(--text-primary)]">Tema</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`rounded-xl border-2 p-4 text-center transition-all ${
                  theme === t.id
                    ? 'border-[#C8923A] bg-[#C8923A]/10'
                    : 'border-[var(--border-color)] hover:border-[#C8923A]/50'
                }`}
              >
                <div className={`mb-3 flex h-14 items-center justify-center rounded-lg ${t.preview}`}>
                  <t.icon className={`h-6 w-6 ${
                    t.id === 'light' ? 'text-yellow-500' : t.id === 'dark' ? 'text-[#D4A85C]' : 'text-zinc-500'
                  }`} />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t.label}</p>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export function Settings() {
  const { showToast } = useToast();

  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    businessName: '',
    phone: '',
    whatsapp: '',
    address: '',
    openingTime: '09:00',
    closingTime: '19:00',
  });
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    appointmentReminders: true,
    reminderHoursBefore: 24,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Commission PIN state
  const [hasCommissionPin, setHasCommissionPin] = useState(false);
  const [currentCommissionPin, setCurrentCommissionPin] = useState('');
  const [commissionPin, setCommissionPin] = useState('');
  const [confirmCommissionPin, setConfirmCommissionPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinVerifyError, setPinVerifyError] = useState('');
  const [pinPasswordInput, setPinPasswordInput] = useState('');
  const [pinPasswordVerified, setPinPasswordVerified] = useState(false);
  const [pinPasswordError, setPinPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<'business' | 'notifications' | 'security' | 'appearance'>('business');

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setBusinessSettings((prev) => ({
        ...prev,
        businessName: data.businessName || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        address: data.address || '',
        openingTime: data.openingTime || '09:00',
        closingTime: data.closingTime || '19:00',
      }));
      setNotificationSettings((prev) => ({
        ...prev,
        emailNotifications: data.emailNotifications ?? true,
        smsNotifications: data.smsNotifications ?? false,
        appointmentReminders: data.appointmentReminders ?? true,
        reminderHoursBefore: data.reminderHoursBefore ?? 24,
      }));
      setHasCommissionPin(!!data.hasCommissionPin);
    }).catch(() => {});
  }, []);

  const handleSaveBusinessSettings = async () => {
    setSavingBusiness(true);
    try {
      await api.patch('/settings', businessSettings);
      showToast('success', 'Configurações salvas com sucesso!');
    } catch {
      showToast('error', 'Erro ao salvar configurações');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingNotifications(true);
    try {
      await api.patch('/settings', notificationSettings);
      showToast('success', 'Configurações de notificação salvas!');
    } catch {
      showToast('error', 'Erro ao salvar configurações');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast('error', 'Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'As senhas não conferem');
      return;
    }
    if (newPassword.length < 6) {
      showToast('error', 'A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      showToast('success', 'Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao alterar senha';
      showToast('error', msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleVerifyCurrentPin = async () => {
    if (!currentCommissionPin) return;
    setSavingPin(true);
    setPinVerifyError('');
    try {
      const { data } = await api.post('/settings/verify-commission-pin', { pin: currentCommissionPin });
      if (data.valid) {
        setPinVerified(true);
      } else {
        setPinVerifyError('PIN incorreto.');
        setCurrentCommissionPin('');
      }
    } catch {
      setPinVerifyError('Erro ao verificar PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  const handleVerifyPasswordForPin = async () => {
    if (!pinPasswordInput) return;
    setVerifyingPassword(true);
    setPinPasswordError('');
    try {
      const { data } = await api.post('/auth/verify-password', { password: pinPasswordInput });
      if (data.valid) {
        setPinPasswordVerified(true);
      } else {
        setPinPasswordError('Senha incorreta.');
        setPinPasswordInput('');
      }
    } catch {
      setPinPasswordError('Erro ao verificar senha.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleSaveCommissionPin = async () => {
    if (commissionPin.length < 4 || commissionPin.length > 6) {
      showToast('error', 'O PIN deve ter entre 4 e 6 dígitos');
      return;
    }
    if (commissionPin !== confirmCommissionPin) {
      showToast('error', 'Os PINs não conferem');
      return;
    }
    setSavingPin(true);
    try {
      await api.patch('/settings/commission-pin', { pin: commissionPin });
      setHasCommissionPin(true);
      setPinVerified(false);
      setCurrentCommissionPin('');
      setCommissionPin('');
      setConfirmCommissionPin('');
      showToast('success', 'PIN de comissões definido com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao definir PIN';
      showToast('error', msg);
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemoveCommissionPin = async () => {
    setSavingPin(true);
    try {
      await api.delete('/settings/commission-pin');
      setHasCommissionPin(false);
      setPinVerified(false);
      setCurrentCommissionPin('');
      showToast('success', 'PIN de comissões removido.');
    } catch {
      showToast('error', 'Erro ao remover PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const tabs = [
    { id: 'business' as const, label: 'Empresa', icon: Building2 },
    { id: 'notifications' as const, label: 'Notificações', icon: Bell },
    { id: 'security' as const, label: 'Segurança', icon: Shield },
    { id: 'appearance' as const, label: 'Aparência', icon: Palette },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">Configurações</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[var(--border-color)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-[#C8923A] text-[#C8923A]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Business Settings */}
      {activeTab === 'business' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Informações da Empresa</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Nome da Empresa
              </label>
              <input
                type="text"
                value={businessSettings.businessName}
                onChange={(e) => setBusinessSettings({ ...businessSettings, businessName: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Telefone
              </label>
              <input
                type="tel"
                value={businessSettings.phone}
                onChange={(e) => setBusinessSettings({ ...businessSettings, phone: formatPhoneInput(e.target.value) })}
                placeholder="(62) 99999-9999"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                <MessageCircle className="h-4 w-4 text-green-500" />
                WhatsApp para contato dos clientes
              </label>
              <input
                type="text"
                value={formatWhatsAppDisplay(businessSettings.whatsapp)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
                  setBusinessSettings({ ...businessSettings, whatsapp: digits });
                }}
                placeholder="+55 (11) 99999-9999"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Usado quando o cliente precisa falar com a barbearia (ex: cancelamento em cima da hora)
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Endereço
              </label>
              <input
                type="text"
                value={businessSettings.address}
                onChange={(e) => setBusinessSettings({ ...businessSettings, address: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>
          </div>

          <h3 className="mb-4 mt-8 text-md font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horário de Funcionamento
          </h3>

          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Horário de Abertura
              </label>
              <input
                type="time"
                value={businessSettings.openingTime}
                onChange={(e) => setBusinessSettings({ ...businessSettings, openingTime: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Horário de Fechamento
              </label>
              <input
                type="time"
                value={businessSettings.closingTime}
                onChange={(e) => setBusinessSettings({ ...businessSettings, closingTime: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>

          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveBusinessSettings}
              disabled={savingBusiness}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-60"
            >
              {savingBusiness ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingBusiness ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Configurações de Notificações</h2>

          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Notificações por E-mail</p>
                <p className="text-sm text-[var(--text-muted)]">Receber notificações por e-mail</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-zinc-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-zinc-300 after:transition-all after:content-[''] peer-checked:bg-[#8B6914] peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white"></div>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Notificações por SMS</p>
                <p className="text-sm text-[var(--text-muted)]">Receber notificações por SMS</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={notificationSettings.smsNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, smsNotifications: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-zinc-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-zinc-300 after:transition-all after:content-[''] peer-checked:bg-[#8B6914] peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white"></div>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Lembretes de Agendamento</p>
                <p className="text-sm text-[var(--text-muted)]">Enviar lembretes para clientes</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={notificationSettings.appointmentReminders}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, appointmentReminders: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-zinc-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-zinc-300 after:transition-all after:content-[''] peer-checked:bg-[#8B6914] peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white"></div>
              </label>
            </div>

            {notificationSettings.appointmentReminders && (
              <div className="ml-4 rounded-xl border border-[#C8923A]/30 bg-[#C8923A]/10 p-4">
                <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                  Enviar lembrete com antecedência de
                </label>
                <select
                  value={notificationSettings.reminderHoursBefore}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderHoursBefore: Number(e.target.value) })}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
                >
                  <option value={1}>1 hora</option>
                  <option value={2}>2 horas</option>
                  <option value={4}>4 horas</option>
                  <option value={12}>12 horas</option>
                  <option value={24}>24 horas</option>
                  <option value={48}>48 horas</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveNotificationSettings}
              disabled={savingNotifications}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-60"
            >
              {savingNotifications ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingNotifications ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Configurações de Segurança</h2>

          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <h3 className="mb-4 font-medium text-[var(--text-primary)]">Alterar Senha</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
                  />
                </div>
                <div></div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-xs text-[#A63030]">As senhas não conferem</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingPassword ? 'Alterando...' : 'Atualizar Senha'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <h3 className="mb-4 font-medium text-[var(--text-primary)]">PIN de Comissões</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">
                Proteja a página de comissões com um PIN. Apenas quem souber o PIN poderá acessar.
              </p>

              {hasCommissionPin && !pinVerified ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-secondary)] p-3">
                    <Shield className="h-5 w-5 text-[#2D8B4E]" />
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)]">PIN ativo</p>
                      <p className="text-sm text-[var(--text-muted)]">A página de comissões está protegida</p>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                      Digite o PIN atual para alterar ou remover
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={currentCommissionPin}
                      onChange={(e) => { setCurrentCommissionPin(e.target.value.slice(0, 6)); setPinVerifyError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyCurrentPin(); }}
                      placeholder="PIN atual"
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] text-center font-mono tracking-widest focus:border-[#C8923A] focus:outline-none"
                    />
                    {pinVerifyError && (
                      <p className="mt-1 text-xs text-[#A63030]">{pinVerifyError}</p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleVerifyCurrentPin}
                      disabled={savingPin || currentCommissionPin.length < 4}
                      className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Verificar
                    </button>
                  </div>
                </div>
              ) : hasCommissionPin && pinVerified ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                        Novo PIN (4-6 caracteres)
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={commissionPin}
                        onChange={(e) => setCommissionPin(e.target.value.slice(0, 6))}
                        placeholder="Novo PIN"
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] text-center font-mono tracking-widest focus:border-[#C8923A] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                        Confirmar novo PIN
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={confirmCommissionPin}
                        onChange={(e) => setConfirmCommissionPin(e.target.value.slice(0, 6))}
                        placeholder="Repita o PIN"
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] text-center font-mono tracking-widest focus:border-[#C8923A] focus:outline-none"
                      />
                      {confirmCommissionPin && commissionPin !== confirmCommissionPin && (
                        <p className="mt-1 text-xs text-[#A63030]">Os PINs não conferem</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleRemoveCommissionPin}
                      disabled={savingPin}
                      className="flex items-center gap-2 rounded-xl border border-[#A63030]/30 px-4 py-2 text-sm font-medium text-[#A63030] hover:bg-[#A63030]/10 disabled:opacity-50"
                    >
                      {savingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Remover PIN
                    </button>
                    <button
                      onClick={handleSaveCommissionPin}
                      disabled={savingPin || commissionPin.length < 4 || commissionPin !== confirmCommissionPin}
                      className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Alterar PIN
                    </button>
                  </div>
                </div>
              ) : !pinPasswordVerified ? (
                <div className="space-y-4">
                  <p className="text-sm text-[var(--text-muted)]">
                    Para definir um PIN, confirme a senha da sua conta.
                  </p>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                      Senha da conta
                    </label>
                    <input
                      type="password"
                      value={pinPasswordInput}
                      onChange={(e) => { setPinPasswordInput(e.target.value); setPinPasswordError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyPasswordForPin(); }}
                      placeholder="Digite sua senha"
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
                    />
                    {pinPasswordError && (
                      <p className="mt-1 text-xs text-[#A63030]">{pinPasswordError}</p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleVerifyPasswordForPin}
                      disabled={verifyingPassword || !pinPasswordInput}
                      className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Confirmar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                        Novo PIN (4-6 caracteres)
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={commissionPin}
                        onChange={(e) => setCommissionPin(e.target.value.slice(0, 6))}
                        placeholder="Ex: ab12"
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] text-center font-mono tracking-widest focus:border-[#C8923A] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                        Confirmar PIN
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={confirmCommissionPin}
                        onChange={(e) => setConfirmCommissionPin(e.target.value.slice(0, 6))}
                        placeholder="Repita o PIN"
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] text-center font-mono tracking-widest focus:border-[#C8923A] focus:outline-none"
                      />
                      {confirmCommissionPin && commissionPin !== confirmCommissionPin && (
                        <p className="mt-1 text-xs text-[#A63030]">Os PINs não conferem</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveCommissionPin}
                      disabled={savingPin || commissionPin.length < 4 || commissionPin !== confirmCommissionPin}
                      className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {savingPin ? 'Salvando...' : 'Definir PIN'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <h3 className="mb-2 font-medium text-[var(--text-primary)]">Sessões Ativas</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">Gerencie onde você está conectado</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-[var(--bg-secondary)] p-3">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Este dispositivo</p>
                    <p className="text-sm text-[var(--text-muted)]">Sessão atual</p>
                  </div>
                  <span className="rounded-full bg-[#C8923A]/20 px-3 py-1 text-xs font-medium text-[#C8923A]">
                    Ativa
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appearance Settings */}
      {activeTab === 'appearance' && (
        <AppearanceTab />
      )}
    </div>
  );
}
