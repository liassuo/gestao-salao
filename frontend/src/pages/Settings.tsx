import { useState } from 'react';
import { Save, Building2, Clock, Bell, Shield, Palette, Sun, Moon, Monitor } from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import { useTheme } from '../contexts/ThemeContext';

interface BusinessSettings {
  businessName: string;
  phone: string;
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

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'light' as const, label: 'Claro', icon: Sun, preview: 'bg-white border border-zinc-200' },
    { id: 'dark' as const, label: 'Escuro', icon: Moon, preview: 'bg-zinc-900' },
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
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-[var(--border-color)] hover:border-blue-500/50'
                }`}
              >
                <div className={`mb-3 flex h-14 items-center justify-center rounded-lg ${t.preview}`}>
                  <t.icon className={`h-6 w-6 ${t.id === 'light' ? 'text-yellow-500' : 'text-blue-400'}`} />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t.label}</p>
              </button>
            ))}
            <button
              disabled
              className="rounded-xl border-2 border-[var(--border-color)] p-4 text-center opacity-50 cursor-not-allowed"
            >
              <div className="mb-3 flex h-14 items-center justify-center rounded-lg bg-gradient-to-r from-white to-zinc-900">
                <Monitor className="h-6 w-6 text-zinc-500" />
              </div>
              <p className="text-sm font-medium text-[var(--text-muted)]">Sistema (em breve)</p>
            </button>
          </div>
        </div>

        <div>
          <h3 className="mb-4 font-medium text-[var(--text-primary)]">Cor Principal</h3>
          <div className="flex gap-3">
            {[
              { color: 'bg-blue-600', ring: 'ring-blue-600', active: true },
              { color: 'bg-red-600', ring: 'ring-red-600', active: false },
              { color: 'bg-zinc-600', ring: 'ring-zinc-600', active: false },
              { color: 'bg-zinc-600', ring: 'ring-zinc-600', active: false },
              { color: 'bg-zinc-600', ring: 'ring-zinc-600', active: false },
            ].map((item) => (
              <button
                key={item.color}
                disabled={!item.active}
                className={`h-10 w-10 rounded-full ${item.color} transition-all ${
                  item.active ? `ring-2 ring-offset-2 ${item.ring} ring-offset-[var(--bg-primary)]` : 'opacity-50 cursor-not-allowed'
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Personalização de cores em breve</p>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const { showToast } = useToast();

  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    businessName: 'Barbearia Exemplo',
    phone: '(11) 99999-9999',
    address: 'Rua Exemplo, 123 - Centro',
    openingTime: '09:00',
    closingTime: '19:00',
    slotDuration: 30,
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    appointmentReminders: true,
    reminderHoursBefore: 24,
  });

  const [activeTab, setActiveTab] = useState<'business' | 'notifications' | 'security' | 'appearance'>('business');

  const handleSaveBusinessSettings = () => {
    // TODO: Implementar API
    showToast('success', 'Configurações salvas com sucesso!');
  };

  const handleSaveNotificationSettings = () => {
    // TODO: Implementar API
    showToast('success', 'Configurações de notificação salvas!');
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
                ? 'border-blue-500 text-blue-500'
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
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
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
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Endereço
              </label>
              <input
                type="text"
                value={businessSettings.address}
                onChange={(e) => setBusinessSettings({ ...businessSettings, address: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
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
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
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
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Duração do Slot (min)
              </label>
              <select
                value={businessSettings.slotDuration}
                onChange={(e) => setBusinessSettings({ ...businessSettings, slotDuration: Number(e.target.value) })}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
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
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save className="h-4 w-4" />
              Salvar Alterações
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
                <div className="peer h-6 w-11 rounded-full bg-zinc-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-zinc-300 after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white"></div>
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
                <div className="peer h-6 w-11 rounded-full bg-zinc-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-zinc-300 after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white"></div>
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
                <div className="peer h-6 w-11 rounded-full bg-zinc-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-zinc-300 after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white"></div>
              </label>
            </div>

            {notificationSettings.appointmentReminders && (
              <div className="ml-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                  Enviar lembrete com antecedência de
                </label>
                <select
                  value={notificationSettings.reminderHoursBefore}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderHoursBefore: Number(e.target.value) })}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
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
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save className="h-4 w-4" />
              Salvar Alterações
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
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div></div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Atualizar Senha
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
              <h3 className="mb-2 font-medium text-[var(--text-primary)]">Sessões Ativas</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">Gerencie onde você está conectado</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-[var(--bg-secondary)] p-3">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Este dispositivo</p>
                    <p className="text-sm text-[var(--text-muted)]">Windows - Chrome</p>
                  </div>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-500">
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
