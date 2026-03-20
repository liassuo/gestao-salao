import { useState } from 'react';
import {
  BarChart3,
  DollarSign,
  Users,
  Scissors,
  AlertCircle,
  Wallet,
  Calendar,
  Download,
} from 'lucide-react';
import { reportsService } from '../services/reports';
import type { SalesReport, ProfessionalReport, ServicesReport, ClientsReport, DebtsReport, CashRegisterReport } from '../services/reports';
import { formatCurrency, formatDate, formatPhone } from '../utils/format';
import { Spinner } from '../components/ui';

type ReportType = 'sales' | 'professionals' | 'services' | 'clients' | 'debts' | 'cash-register';

const reportOptions = [
  { id: 'sales' as ReportType, label: 'Vendas', icon: DollarSign },
  { id: 'professionals' as ReportType, label: 'Profissionais', icon: Users },
  { id: 'services' as ReportType, label: 'Serviços', icon: Scissors },
  { id: 'clients' as ReportType, label: 'Clientes', icon: Users },
  { id: 'debts' as ReportType, label: 'Dívidas', icon: AlertCircle },
  { id: 'cash-register' as ReportType, label: 'Caixa', icon: Wallet },
];

export function Reports() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('sales');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let result;
      switch (selectedReport) {
        case 'sales':
          result = await reportsService.getSalesReport(startDate, endDate);
          break;
        case 'professionals':
          result = await reportsService.getProfessionalsReport(startDate, endDate);
          break;
        case 'services':
          result = await reportsService.getServicesReport(startDate, endDate);
          break;
        case 'clients':
          result = await reportsService.getClientsReport(startDate, endDate);
          break;
        case 'debts':
          result = await reportsService.getDebtsReport(startDate, endDate);
          break;
        case 'cash-register':
          result = await reportsService.getCashRegisterReport(startDate, endDate);
          break;
      }
      setData(result);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    let csvContent = '';
    const reportLabel = reportOptions.find((r) => r.id === selectedReport)?.label || selectedReport;

    const formatValue = (v: any) => {
      if (typeof v === 'number') return v.toString();
      if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
      return String(v ?? '');
    };

    // Extrai dados tabulares de cada tipo de relatório
    let rows: Record<string, any>[] = [];
    switch (selectedReport) {
      case 'sales':
        rows = data.byMethod || [];
        break;
      case 'professionals':
        rows = data.professionals || [];
        break;
      case 'services':
        rows = data.services || [];
        break;
      case 'clients':
        rows = data.clients || [];
        break;
      case 'debts':
        rows = data.debts || [];
        break;
      case 'cash-register':
        rows = data.registers || [];
        break;
    }

    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    csvContent = headers.join(';') + '\n';
    for (const row of rows) {
      csvContent += headers.map((h) => formatValue(row[h])).join(';') + '\n';
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${reportLabel}-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderSalesReport = (report: SalesReport) => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Receita Total</p>
          <p className="text-2xl font-bold text-[#C8923A]">{formatCurrency(report.summary.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Transações</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{report.summary.totalTransactions}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Ticket Médio</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(report.summary.averageTicket)}</p>
        </div>
      </div>

      {/* By Method */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
        <h4 className="mb-4 font-semibold text-[var(--text-primary)]">Por Método de Pagamento</h4>
        <div className="space-y-2">
          {report.byMethod.map((item) => (
            <div key={item.method} className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">{item.method}</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-[var(--text-muted)]">{item.count} transações</span>
                <span className="font-medium text-[var(--text-primary)]">{formatCurrency(item.total)}</span>
                <span className="text-sm text-[var(--text-muted)]">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
        <h4 className="mb-4 font-semibold text-[var(--text-primary)]">Transações</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border-color)]">
              <tr className="text-[var(--text-muted)]">
                <th className="pb-2 text-left">Data</th>
                <th className="pb-2 text-left">Cliente</th>
                <th className="pb-2 text-left">Profissional</th>
                <th className="pb-2 text-left">Serviços</th>
                <th className="pb-2 text-left">Método</th>
                <th className="pb-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {report.transactions.slice(0, 20).map((tx) => (
                <tr key={tx.id} className="text-[var(--text-secondary)]">
                  <td className="py-2">{formatDate(tx.date)}</td>
                  <td className="py-2">{tx.clientName}</td>
                  <td className="py-2">{tx.professionalName}</td>
                  <td className="py-2 max-w-[200px] truncate">{tx.services}</td>
                  <td className="py-2">{tx.method}</td>
                  <td className="py-2 text-right font-medium text-[var(--text-primary)]">{formatCurrency(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderProfessionalsReport = (report: ProfessionalReport[]) => (
    <div className="space-y-4">
      {report.map((prof) => (
        <div key={prof.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <h4 className="mb-4 font-semibold text-[var(--text-primary)]">{prof.name}</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-2">Atendimentos</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-[var(--text-secondary)]">
                <span>Total: {prof.stats.total}</span>
                <span className="text-[#C8923A]">Atendidos: {prof.stats.attended}</span>
                <span className="text-[#A63030]">Cancelados: {prof.stats.canceled}</span>
                <span className="text-[#A63030]">Não compareceu: {prof.stats.noShow}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Taxa de comparecimento: <strong className="text-[var(--text-primary)]">{prof.stats.attendanceRate}%</strong></p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-2">Financeiro</p>
              <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                <p>Receita: <strong className="text-[var(--text-primary)]">{formatCurrency(prof.financial.totalRevenue)}</strong></p>
                <p>Comissão ({prof.commissionRate}%): <strong className="text-[var(--text-primary)]">{formatCurrency(prof.financial.commission)}</strong></p>
                <p>Ticket médio: <strong className="text-[var(--text-primary)]">{formatCurrency(prof.financial.averageTicket)}</strong></p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderServicesReport = (report: ServicesReport[]) => {
    const totalRevenue = report.reduce((sum, s) => sum + s.revenue, 0);
    const totalCount = report.reduce((sum, s) => sum + s.count, 0);

    return (
      <div className="space-y-4">
        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
            <p className="text-sm text-[var(--text-muted)]">Receita Total</p>
            <p className="text-2xl font-bold text-[#C8923A]">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
            <p className="text-sm text-[var(--text-muted)]">Total de Atendimentos</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
            <p className="text-sm text-[var(--text-muted)]">Ticket Médio por Serviço</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCount > 0 ? formatCurrency(Math.round(totalRevenue / totalCount)) : formatCurrency(0)}</p>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <h4 className="mb-4 font-semibold text-[var(--text-primary)]">Serviços Mais Realizados</h4>
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border-color)]">
              <tr className="text-[var(--text-muted)]">
                <th className="pb-2 text-left">Serviço</th>
                <th className="pb-2 text-right">Preço</th>
                <th className="pb-2 text-right">Quantidade</th>
                <th className="pb-2 text-right">Receita</th>
                <th className="pb-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {report.map((service) => (
                <tr key={service.id} className="text-[var(--text-secondary)]">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {service.name}
                      {service.hadPromotion && (
                        <span className="inline-flex items-center rounded-md bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-500 ring-1 ring-inset ring-green-500/20">
                          PROMO
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right">{formatCurrency(service.price)}</td>
                  <td className="py-2 text-right">{service.count}</td>
                  <td className="py-2 text-right font-medium text-[var(--text-primary)]">{formatCurrency(service.revenue)}</td>
                  <td className="py-2 text-right text-[var(--text-muted)]">{service.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderClientsReport = (report: ClientsReport) => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Novos Clientes</p>
          <p className="text-2xl font-bold text-[#C8923A]">{report.summary.newClients}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Clientes Ativos</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{report.summary.activeClients}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Com Dívidas</p>
          <p className="text-2xl font-bold text-[#A63030]">{report.summary.clientsWithDebts}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Total em Dívidas</p>
          <p className="text-2xl font-bold text-[#A63030]">{formatCurrency(report.summary.totalDebt)}</p>
        </div>
      </div>

      {/* Top Clients */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
        <h4 className="mb-4 font-semibold text-[var(--text-primary)]">Top Clientes</h4>
        <table className="min-w-full text-sm">
          <thead className="border-b border-[var(--border-color)]">
            <tr className="text-[var(--text-muted)]">
              <th className="pb-2 text-left">Nome</th>
              <th className="pb-2 text-left">Telefone</th>
              <th className="pb-2 text-right">Atendimentos</th>
              <th className="pb-2 text-right">Total Gasto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {report.topClients.map((client) => (
              <tr key={client.id} className="text-[var(--text-secondary)]">
                <td className="py-2">{client.name}</td>
                <td className="py-2">{formatPhone(client.phone)}</td>
                <td className="py-2 text-right">{client.appointmentsCount}</td>
                <td className="py-2 text-right font-medium text-[var(--text-primary)]">{formatCurrency(client.totalSpent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Debtors */}
      {report.debtors.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <h4 className="mb-4 font-semibold text-[#A63030]">Clientes com Dívidas</h4>
          <table className="min-w-full text-sm">
            <thead className="border-b border-red-500/30">
              <tr className="text-[#C45050]">
                <th className="pb-2 text-left">Nome</th>
                <th className="pb-2 text-left">Telefone</th>
                <th className="pb-2 text-right">Dívidas</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-500/20">
              {report.debtors.map((debtor) => (
                <tr key={debtor.id} className="text-[var(--text-secondary)]">
                  <td className="py-2">{debtor.name}</td>
                  <td className="py-2">{formatPhone(debtor.phone)}</td>
                  <td className="py-2 text-right">{debtor.debtsCount}</td>
                  <td className="py-2 text-right font-medium text-[#A63030]">{formatCurrency(debtor.totalDebt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderDebtsReport = (report: DebtsReport) => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Dívidas Criadas</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{report.summary.debtsCreatedCount}</p>
          <p className="text-sm text-[var(--text-muted)]">{formatCurrency(report.summary.totalCreated)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Dívidas Pagas</p>
          <p className="text-2xl font-bold text-[#C8923A]">{report.summary.debtsPaidCount}</p>
          <p className="text-sm text-[var(--text-muted)]">{formatCurrency(report.summary.totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-[var(--text-muted)]">Em Aberto</p>
          <p className="text-2xl font-bold text-[#A63030]">{report.summary.currentDebtsCount}</p>
          <p className="text-sm text-[#C45050]">{formatCurrency(report.summary.totalOutstanding)}</p>
        </div>
      </div>

      {/* Outstanding */}
      {report.outstanding.length > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <h4 className="mb-4 font-semibold text-[var(--text-primary)]">Dívidas em Aberto</h4>
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--border-color)]">
              <tr className="text-[var(--text-muted)]">
                <th className="pb-2 text-left">Cliente</th>
                <th className="pb-2 text-left">Telefone</th>
                <th className="pb-2 text-right">Valor</th>
                <th className="pb-2 text-right">Pago</th>
                <th className="pb-2 text-right">Restante</th>
                <th className="pb-2 text-right">Dias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {report.outstanding.map((debt) => (
                <tr key={debt.id} className="text-[var(--text-secondary)]">
                  <td className="py-2">{debt.clientName}</td>
                  <td className="py-2">{debt.clientPhone}</td>
                  <td className="py-2 text-right">{formatCurrency(debt.amount)}</td>
                  <td className="py-2 text-right text-[#C8923A]">{formatCurrency(debt.amountPaid)}</td>
                  <td className="py-2 text-right font-medium text-[#A63030]">{formatCurrency(debt.remainingBalance)}</td>
                  <td className="py-2 text-right text-[var(--text-muted)]">{debt.daysPending}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderCashRegisterReport = (report: CashRegisterReport) => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Receita Total</p>
          <p className="text-2xl font-bold text-[#C8923A]">{formatCurrency(report.summary.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Média Diária</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(report.summary.averageDaily)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Dias</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{report.summary.daysCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Diferença Total</p>
          <p className={`text-2xl font-bold ${report.summary.totalDiscrepancy === 0 ? 'text-[#C8923A]' : 'text-[#A63030]'}`}>
            {formatCurrency(report.summary.totalDiscrepancy)}
          </p>
        </div>
      </div>

      {/* By Method */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Dinheiro</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(report.summary.totalCash)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">PIX</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(report.summary.totalPix)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
          <p className="text-sm text-[var(--text-muted)]">Cartão</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(report.summary.totalCard)}</p>
        </div>
      </div>

      {/* Registers */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] p-4">
        <h4 className="mb-4 font-semibold text-[var(--text-primary)]">Histórico de Caixas</h4>
        <table className="min-w-full text-sm">
          <thead className="border-b border-[var(--border-color)]">
            <tr className="text-[var(--text-muted)]">
              <th className="pb-2 text-left">Data</th>
              <th className="pb-2 text-left">Aberto por</th>
              <th className="pb-2 text-left">Status</th>
              <th className="pb-2 text-right">Receita</th>
              <th className="pb-2 text-right">Diferença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {report.registers.map((reg) => (
              <tr key={reg.id} className="text-[var(--text-secondary)]">
                <td className="py-2">{formatDate(reg.date)}</td>
                <td className="py-2">{reg.openedBy}</td>
                <td className="py-2">
                  <span className={`rounded-lg px-2 py-0.5 text-xs ${reg.isOpen ? 'bg-[#C8923A]/20 text-[#C8923A]' : 'bg-[var(--hover-bg)] text-[var(--text-muted)]'}`}>
                    {reg.isOpen ? 'Aberto' : 'Fechado'}
                  </span>
                </td>
                <td className="py-2 text-right font-medium text-[var(--text-primary)]">{formatCurrency(reg.totalRevenue || 0)}</td>
                <td className={`py-2 text-right ${(reg.discrepancy || 0) === 0 ? '' : 'text-[#A63030]'}`}>
                  {formatCurrency(reg.discrepancy || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      );
    }

    if (!data) {
      return (
        <div className="text-center py-12 text-[var(--text-muted)]">
          Selecione um período e clique em "Gerar Relatório"
        </div>
      );
    }

    switch (selectedReport) {
      case 'sales':
        return renderSalesReport(data as SalesReport);
      case 'professionals':
        return renderProfessionalsReport(data as ProfessionalReport[]);
      case 'services':
        return renderServicesReport(data as ServicesReport[]);
      case 'clients':
        return renderClientsReport(data as ClientsReport);
      case 'debts':
        return renderDebtsReport(data as DebtsReport);
      case 'cash-register':
        return renderCashRegisterReport(data as CashRegisterReport);
      default:
        return null;
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">Relatórios</h1>

      {/* Report Selection */}
      <div className="mb-6 flex flex-wrap gap-2">
        {reportOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              setSelectedReport(option.id);
              setData(null);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              selectedReport === option.id
                ? 'bg-[#8B6914] text-white'
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <option.icon className="h-4 w-4" />
            {option.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Data Inicial
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Data Final
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-6 py-2 text-sm font-medium text-white hover:bg-[#725510] disabled:opacity-50"
            >
              <BarChart3 className="h-4 w-4" />
              Gerar Relatorio
            </button>
            {data && (
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6">
        {renderReportContent()}
      </div>
    </div>
  );
}
