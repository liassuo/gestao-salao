import { useState } from 'react';
import {
  Wallet,
  AlertCircle,
  History,
  CheckCircle2,
  Clock,
  Banknote,
  Smartphone,
  CreditCard,
} from 'lucide-react';
import {
  useCashRegisterToday,
  useOpenCashRegister,
  useCloseCashRegister,
  useCashRegisters,
  useCashRegisterSummary,
  getApiErrorMessage,
} from '@/hooks';
import {
  CashRegisterFilters,
  CashRegisterStatus,
  CashRegisterSummary,
  CashRegisterTable,
  CloseCashRegisterModal,
  OpenCashRegisterForm,
} from '@/components/cash-register';
import { SkeletonTable, SkeletonSummaryCards, SkeletonCard, useToast } from '@/components/ui';
import type {
  CashRegisterFilters as CashRegisterFiltersType,
  OpenCashRegisterPayload,
  CloseCashRegisterPayload,
  CashRegister as CashRegisterType,
} from '@/types';

type Tab = 'today' | 'history';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Componente para quando o caixa já foi fechado hoje */
function ClosedTodaySummary({ cashRegister }: { cashRegister: CashRegisterType }) {
  const totalRevenue = cashRegister.totalRevenue ?? 0;
  const totalCash = cashRegister.totalCash ?? 0;
  const totalPix = cashRegister.totalPix ?? 0;
  const totalCard = cashRegister.totalCard ?? 0;
  const discrepancy = cashRegister.discrepancy ?? 0;

  const discColor =
    discrepancy > 0
      ? 'text-amber-500'
      : discrepancy < 0
      ? 'text-[#A63030]'
      : 'text-green-500';
  const discBg =
    discrepancy > 0
      ? 'bg-amber-500/10 border-amber-500/30'
      : discrepancy < 0
      ? 'bg-red-500/10 border-red-500/30'
      : 'bg-green-500/10 border-green-500/30';

  return (
    <div className="space-y-5">
      {/* Banner fechado */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-600 to-zinc-700 p-6 text-white">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-white/10" />
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-lg font-bold">Caixa Fechado</span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">O caixa de hoje ja foi encerrado</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400 uppercase">Receita do dia</p>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm text-zinc-300">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Aberto as {formatTime(cashRegister.openedAt)}
          </div>
          {cashRegister.closedAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Fechado as {formatTime(cashRegister.closedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Cards de método */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Banknote className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Dinheiro</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(totalCash)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Smartphone className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">PIX</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(totalPix)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <CreditCard className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Cartao</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(totalCard)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Discrepância */}
      <div className={`flex items-center justify-between rounded-xl border p-4 ${discBg}`}>
        <span className={`text-sm font-semibold ${discColor}`}>
          {discrepancy > 0
            ? 'Sobra'
            : discrepancy < 0
            ? 'Falta'
            : 'Caixa conferido'}
        </span>
        <span className={`text-lg font-bold ${discColor}`}>
          {discrepancy !== 0 && (discrepancy > 0 ? '+' : '')}
          {formatCurrency(discrepancy)}
        </span>
      </div>
    </div>
  );
}

export function CashRegister() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<CashRegisterFiltersType>({});
  const [openError, setOpenError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const {
    data: todayCashRegister,
    isLoading: isLoadingToday,
    isError: isErrorToday,
    error: errorToday,
  } = useCashRegisterToday();

  const { data: cashRegisters, isLoading: isLoadingHistory } =
    useCashRegisters(historyFilters);

  const { data: summary, isLoading: isLoadingSummary } =
    useCashRegisterSummary(historyFilters);

  const openCashRegister = useOpenCashRegister();
  const closeCashRegister = useCloseCashRegister();
  const toast = useToast();

  const handleOpenCashRegister = async (payload: OpenCashRegisterPayload) => {
    setOpenError(null);
    try {
      await openCashRegister.mutateAsync(payload);
      toast.success('Caixa aberto', 'O caixa foi aberto com sucesso. Bom trabalho!');
    } catch (err) {
      setOpenError(getApiErrorMessage(err));
    }
  };

  const handleOpenCloseModal = () => {
    setCloseError(null);
    setIsCloseModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCloseModalOpen(false);
    setCloseError(null);
  };

  const handleCloseCashRegister = async (payload: CloseCashRegisterPayload) => {
    if (!todayCashRegister) return;
    setCloseError(null);
    try {
      await closeCashRegister.mutateAsync({
        id: todayCashRegister.id,
        payload,
      });
      handleCloseModal();
      toast.success('Caixa fechado', 'O caixa foi fechado com sucesso.');
    } catch (err) {
      setCloseError(getApiErrorMessage(err));
    }
  };

  // Determinar estado do caixa de hoje
  const isClosed = todayCashRegister && !todayCashRegister.isOpen;
  const isOpen = todayCashRegister?.isOpen;
  const needsOpening = !todayCashRegister;

  const tabs = [
    { id: 'today' as const, label: 'Caixa de Hoje', icon: Wallet },
    { id: 'history' as const, label: 'Historico', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
          <Wallet className="h-5 w-5 text-[#C8923A]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Caixa</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Controle de abertura e fechamento de caixa
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border-color)]">
        <nav className="-mb-px flex gap-4" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8923A] ${
                activeTab === tab.id
                  ? 'border-[#C8923A] text-[#C8923A]'
                  : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'today' && (
        <div>
          {isLoadingToday ? (
            <div className="mx-auto max-w-md">
              <SkeletonCard />
            </div>
          ) : isErrorToday ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-[#A63030]" />
                <div>
                  <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
                  <p className="text-sm text-[#C45050]">
                    {errorToday instanceof Error
                      ? errorToday.message
                      : 'Ocorreu um erro inesperado. Tente novamente.'}
                  </p>
                </div>
              </div>
            </div>
          ) : isOpen ? (
            <CashRegisterStatus
              cashRegister={todayCashRegister!}
              onClose={handleOpenCloseModal}
            />
          ) : isClosed ? (
            <ClosedTodaySummary cashRegister={todayCashRegister!} />
          ) : (
            <OpenCashRegisterForm
              onSubmit={handleOpenCashRegister}
              isLoading={openCashRegister.isPending}
              error={openError}
            />
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <CashRegisterFilters
            filters={historyFilters}
            onChange={setHistoryFilters}
          />

          {isLoadingSummary ? (
            <SkeletonSummaryCards count={5} />
          ) : (
            <CashRegisterSummary
              summary={
                summary || {
                  totalRevenue: 0,
                  totalCash: 0,
                  totalPix: 0,
                  totalCard: 0,
                  totalDiscrepancy: 0,
                  count: 0,
                }
              }
              isLoading={false}
            />
          )}

          {isLoadingHistory ? (
            <SkeletonTable rows={5} cols={6} />
          ) : (
            <CashRegisterTable cashRegisters={cashRegisters || []} />
          )}
        </div>
      )}

      {/* Modal de Fechamento */}
      <CloseCashRegisterModal
        isOpen={isCloseModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCloseCashRegister}
        cashRegister={todayCashRegister || null}
        isLoading={closeCashRegister.isPending}
        error={closeError}
      />
    </div>
  );
}
