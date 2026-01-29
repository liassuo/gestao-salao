import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../auth';

export function ClientProfile() {
  const navigate = useNavigate();
  const { user, logout, isLoading } = useClientAuth();

  const handleLogout = () => {
    if (window.confirm('Tem certeza que deseja sair da sua conta?')) {
      logout();
      navigate('/cliente/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center px-2 py-3">
        <button onClick={() => navigate('/cliente')} className="p-2">
          <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-gray-900 dark:text-white">
          Meu Perfil
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="px-5 py-4">
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-3">
            <span className="text-3xl font-semibold text-teal-600 dark:text-teal-400">
              {user?.name?.charAt(0)?.toUpperCase() || 'C'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name || 'Cliente'}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{user?.email}</p>
        </div>

        {/* Info Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            Informacoes
          </p>

          <div className="flex items-center py-2">
            <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Nome</p>
              <p className="text-gray-900 dark:text-white font-medium">{user?.name || '-'}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

          <div className="flex items-center py-2">
            <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">E-mail</p>
              <p className="text-gray-900 dark:text-white font-medium">{user?.email || '-'}</p>
            </div>
          </div>

          {user?.phone && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>
              <div className="flex items-center py-2">
                <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Telefone</p>
                  <p className="text-gray-900 dark:text-white font-medium">{user.phone}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full flex items-center py-2"
          >
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="flex-1 text-left text-red-600 dark:text-red-400 font-medium">
              Sair da conta
            </span>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-gray-400 dark:text-gray-500 text-xs mt-6">
          Versao 1.0.0
        </p>
      </div>
    </div>
  );
}
