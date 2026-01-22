import { useState } from 'react';
import { Wallet, AlertCircle, History } from 'lucide-react';
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
} from '@/types';

type Tab = 'today' | 'history';

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

  const tabs = [
    { id: 'today' as const, label: 'Caixa de Hoje', icon: Wallet },
    { id: 'history' as const, label: 'Histórico', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
          <Wallet className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Caixa</h1>
          <p className="text-sm text-gray-500">
            Controle de abertura e fechamento de caixa
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
            <div className="rounded-xl bg-red-50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <h3 className="font-medium text-red-800">Erro ao carregar</h3>
                  <p className="text-sm text-red-600">
                    {errorToday instanceof Error
                      ? errorToday.message
                      : 'Ocorreu um erro inesperado. Tente novamente.'}
                  </p>
                </div>
              </div>
            </div>
          ) : todayCashRegister?.isOpen ? (
            <CashRegisterStatus
              cashRegister={todayCashRegister}
              onClose={handleOpenCloseModal}
            />
          ) : (
            <div className="mx-auto max-w-md">
              <OpenCashRegisterForm
                onSubmit={handleOpenCashRegister}
                isLoading={openCashRegister.isPending}
                error={openError}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filtros */}
          <CashRegisterFilters
            filters={historyFilters}
            onChange={setHistoryFilters}
          />

          {/* Resumo */}
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

          {/* Tabela */}
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
