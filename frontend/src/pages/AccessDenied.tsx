import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

export function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <ShieldX className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">
          Acesso Negado
        </h1>
        <p className="mb-6 text-gray-500">
          Você não tem permissão para acessar esta página.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
