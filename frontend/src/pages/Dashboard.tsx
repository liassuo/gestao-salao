import { Calendar, Users, DollarSign, TrendingUp } from 'lucide-react';

const stats = [
  {
    label: 'Agendamentos Hoje',
    value: '12',
    icon: Calendar,
    color: 'bg-blue-500',
  },
  {
    label: 'Clientes Ativos',
    value: '248',
    icon: Users,
    color: 'bg-green-500',
  },
  {
    label: 'Receita do Dia',
    value: 'R$ 1.250',
    icon: DollarSign,
    color: 'bg-yellow-500',
  },
  {
    label: 'Taxa de Comparecimento',
    value: '94%',
    icon: TrendingUp,
    color: 'bg-purple-500',
  },
];

export function Dashboard() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}
              >
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Próximos Agendamentos
          </h3>
          <p className="text-gray-500">Nenhum agendamento para hoje.</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Atividade Recente
          </h3>
          <p className="text-gray-500">Nenhuma atividade recente.</p>
        </div>
      </div>
    </div>
  );
}
