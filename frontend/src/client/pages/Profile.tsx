import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../auth';
import { clientApi } from '../services/api';
import { formatPhone } from '@/utils/format';

interface ClientProfile {
  id: string;
  name: string;
  email?: string | null;
  phone?: string;
  cpf?: string | null;
  birthDate?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt?: string;
  lastVisitAt?: string | null;
}


function formatCpf(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length === 11) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  return cpf;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center py-2">
      <div className="w-10 h-10 rounded-lg bg-[#C8923A]/20 flex items-center justify-center mr-3">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-[var(--text-primary)] font-medium">{value}</p>
      </div>
    </div>
  );
}

const iconClass = "w-5 h-5 text-[#C8923A]";

const UserIcon = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const MailIcon = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const PhoneIcon = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const IdIcon = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
  </svg>
);

const CalendarIcon = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const MapIcon = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const Divider = () => <div className="border-t border-[var(--border-color)] my-2" />;

export function ClientProfile() {
  const navigate = useNavigate();
  const { user, logout, isLoading: authLoading } = useClientAuth();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    if (user?.id) {
      clientApi.get(`/clients/${user.id}`)
        .then((res) => setProfile(res.data))
        .catch(() => setProfileError(true));
    }
  }, [user?.id]);

  const handleLogout = () => {
    if (window.confirm('Tem certeza que deseja sair da sua conta?')) {
      logout();
      navigate('/cliente/login');
    }
  };

  if (profileError) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[var(--text-primary)] font-medium">Erro ao carregar perfil</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Tente novamente mais tarde</p>
          <button onClick={() => navigate('/cliente')} className="mt-4 text-sm text-[#C8923A]">Voltar</button>
        </div>
      </div>
    );
  }

  const data = profile || user;
  const fullAddress = [
    profile?.address && `${profile.address}${profile.addressNumber ? `, ${profile.addressNumber}` : ''}`,
    profile?.neighborhood,
    profile?.city && profile?.state ? `${profile.city} - ${profile.state}` : profile?.city || profile?.state,
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="flex items-center px-2 py-3">
        <button onClick={() => navigate('/cliente')} className="p-2">
          <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-[var(--text-primary)]">
          Meu Perfil
        </h1>
        <div className="w-10" />
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#C8923A]/20 flex items-center justify-center mb-3">
            <span className="text-3xl font-semibold text-[#C8923A]">
              {data?.name?.charAt(0)?.toUpperCase() || 'C'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{data?.name || 'Cliente'}</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{data?.email}</p>
        </div>

        {/* Dados Pessoais */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-3">
            Dados Pessoais
          </p>

          <InfoRow icon={<UserIcon />} label="Nome" value={data?.name || '-'} />
          <Divider />
          <InfoRow icon={<MailIcon />} label="E-mail" value={data?.email || '-'} />

          {data?.phone && (
            <>
              <Divider />
              <InfoRow icon={<PhoneIcon />} label="Telefone" value={formatPhone(data.phone)} />
            </>
          )}

          {profile?.cpf && (
            <>
              <Divider />
              <InfoRow icon={<IdIcon />} label="CPF" value={formatCpf(profile.cpf)} />
            </>
          )}

          {profile?.birthDate && (
            <>
              <Divider />
              <InfoRow icon={<CalendarIcon />} label="Data de Nascimento" value={formatDate(profile.birthDate)} />
            </>
          )}
        </div>

        {/* Endereço */}
        {fullAddress && (
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-3">
              Endereço
            </p>
            <InfoRow icon={<MapIcon />} label="Endereço" value={fullAddress} />
          </div>
        )}

        {/* Informações */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-3">
            Informações
          </p>
          <InfoRow
            icon={<CalendarIcon />}
            label="Cliente desde"
            value={profile?.createdAt ? formatDate(profile.createdAt) : '-'}
          />
          {profile?.lastVisitAt && (
            <>
              <Divider />
              <InfoRow
                icon={<CalendarIcon />}
                label="Última visita"
                value={formatDate(profile.lastVisitAt)}
              />
            </>
          )}
        </div>

        {/* Ações */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <button
            onClick={handleLogout}
            disabled={authLoading}
            className="w-full flex items-center py-2"
          >
            <div className="w-10 h-10 rounded-lg bg-[#8B2020]/20 flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-[#A63030]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="flex-1 text-left text-[#A63030] font-medium">
              Sair da conta
            </span>
            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <p className="text-center text-[var(--text-muted)] text-xs mt-6">
          Versão 1.0.0
        </p>
      </div>
    </div>
  );
}
