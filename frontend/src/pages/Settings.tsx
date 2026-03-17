import { useState, useEffect } from 'react';
import { Save, Building2, Clock, Bell, Shield, Palette, Sun, Moon, Monitor, MessageCircle, Loader2, Check } from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

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
  slotDuration: number;
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  appointmentReminders: boolean;
  reminderHoursBefore: number;
}

const ACCENT_COLORS = [
  { name: 'Dourado', value: '#8B6914', ring: 'ring-[#8B6914]' },
  { name: 'Vermelho', value: '#8B2020', ring: 'ring-[#8B2020]' },
  { name: 'Azul', value: '#1D4ED8', ring: 'ring-[#1D4ED8]' },
  { name: 'Verde', value: '#047857', ring: 'ring-[#047857]' },
  { name: 'Roxo', value: '#7C3AED', ring: 'ring-[#7C3AED]' },
];

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('accentColor') || '#8B6914';
  });

  const handleSetAccent = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('accentColor', color);
    document.documentElement.style.setProperty('--accent-color', color);
  };

  const themes = [
    { id: 'light' as const, label: 'Claro', icon: Sun, preview: 'bg-white border border-zinc-200' },
    { id: 'dark' as const, label: 'Escuro', icon: Moon, preview: 'bg-zinc-900' },
    { id: 'system' as const, label: 'Sistema', icon: Monitor, preview: 'bg-gradient-to-r from-white to-zinc-900' },
  ];

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
      <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Configuracoes de Aparencia</h2>

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

        <div>
          <h3 className="mb-4 font-medium text-[var(--text-primary)]">Cor Principal</h3>
          <div className="flex gap-3">
            {ACCENT_COLORS.map((item) => (
              <button
                key={item.value}
                onClick={() => handleSetAccent(item.value)}
                className={`h-10 w-10 rounded-full transition-all ${
                  accentColor === item.value
                    ? `ring-2 ring-offset-2 ${item.ring} ring-offset-[var(--bg-primary)]`
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: item.value }}
                title={item.name}
              />
            ))}
          </div>
          {accentColor !== '#8B6914' && (
            <button
              onClick={() => handleSetAccent('#8B6914')}
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              Restaurar cor padrao
            </button>
          )}
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
    slotDuration: 30,
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
        slotDuration: data.slotDuration || 30,
      }));
      setNotificationSettings((prev) => ({
        ...prev,
        emailNotifications: data.emailNotifications ?? true,
        smsNotifications: data.smsNotifications ?? false,
        appointmentReminders: data.appointmentReminders ?? true,
        reminderHoursBefore: data.reminderHoursBefore ?? 24,
      }));
    }).catch(() => {});
  }, []);

  const handleSaveBusinessSettings = async () => {
    setSavingBusiness(true);
    try {
      await api.patch('/settings', businessSettings);
      showToast('success', 'Configuracoes salvas com sucesso!');
    } catch {
      showToast('error', 'Erro ao salvar configuracoes');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingNotifications(true);
    try {
      await api.patch('/settings', notificationSettings);
      showToast('success', 'Configuracoes de notificacao salvas!');
    } catch {
      showToast('error', 'Erro ao salvar configuracoes');
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
      showToast('error', 'As senhas nao conferem');
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

  const tabs = [
    { id: 'business' as const, label: 'Empresa', icon: Building2 },
    { id: 'notifications' as const, label: 'Notificacoes', icon: Bell },
    { id: 'security' as const, label: 'Seguranca', icon: Shield },
    { id: 'appearance' as const, label: 'Aparencia', icon: Palette },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">Configuracoes</h1>

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
          <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Informacoes da Empresa</h2>

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
                type="text"
                value={businessSettings.phone}
                onChange={(e) => setBusinessSettings({ ...businessSettings, phone: e.target.value })}
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
                Endereco
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
            Horario de Funcionamento
          </h3>

          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Horario de Abertura
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
                Horario de Fechamento
              </label>
              <input
                type="time"
                value={businessSettings.closingTime}
                onChange={(e) => setBusinessSettings({ ...businessSettings, closingTime: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Duracao do Slot (min)
              </label>
              <select
                value={businessSettings.slotDuration}
                onChange={(e) => setBusinessSettings({ ...businessSettings, slotDuration: Number(e.target.value) })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveBusinessSettings}
              disabled={savingBusiness}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-60"
            >
              {savingBusiness ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingBusiness ? 'Salvando...' : 'Salvar Alteracoes'}
            </button>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Configuracoes de Notificacoes</h2>

          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Notificacoes por E-mail</p>
                <p className="text-sm text-[var(--text-muted)]">Receber notificacoes por e-mail</p>
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
                <p className="font-medium text-[var(--text-primary)]">Notificacoes por SMS</p>
                <p className="text-sm text-[var(--text-muted)]">Receber notificacoes por SMS</p>
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
                  Enviar lembrete com antecedencia de
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
              {savingNotifications ? 'Salvando...' : 'Salvar Alteracoes'}
            </button>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">Configuracoes de Seguranca</h2>

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
                    <p className="mt-1 text-xs text-[#A63030]">As senhas nao conferem</p>
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
              <h3 className="mb-2 font-medium text-[var(--text-primary)]">Sessoes Ativas</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">Gerencie onde voce esta conectado</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-[var(--bg-secondary)] p-3">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Este dispositivo</p>
                    <p className="text-sm text-[var(--text-muted)]">Sessao atual</p>
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
