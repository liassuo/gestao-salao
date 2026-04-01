import { useState } from 'react';
import { Calendar, AlertCircle, Plus, Table, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useAppointments,
  useAppointmentActions,
  useProfessionals,
  useCreateAppointment,
  useCreateDebt,
  getApiErrorMessage,
} from '@/hooks';
import {
  AppointmentFiltersComponent,
  AppointmentForm,
  AppointmentsTable,
  CalendarView,
} from '@/components/appointments';
import { DebtForm } from '@/components/debts';
import { Modal, SkeletonTable, useToast, PixPaymentModal } from '@/components/ui';
import type { Appointment, AppointmentFilters, CreateAppointmentPayload, CreateDebtPayload } from '@/types';

type ViewMode = 'calendar' | 'table';

const initialFilters: AppointmentFilters = {};

export function Appointments() {
  const [activeView, setActiveView] = useState<ViewMode>('calendar');
  const [filters, setFilters] = useState<AppointmentFilters>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [appointmentPrefill, setAppointmentPrefill] = useState<{ professionalId?: string; date?: string; time?: string } | undefined>();

  // Gerar Dívida state
  const [debtModalAppointment, setDebtModalAppointment] = useState<Appointment | null>(null);
  const [debtFormError, setDebtFormError] = useState<string | null>(null);
  
  // Pix Payment state
  const [pixModalData, setPixModalData] = useState<{ pixData: any; amount: number; description?: string; appointmentId?: string } | null>(null);

  const { data: appointments, isLoading, isError, error } = useAppointments(filters);
  const { data: professionals = [] } = useProfessionals();
  const { attend, cancel, noShow, isLoading: isActionLoading } = useAppointmentActions();
  const createAppointment = useCreateAppointment();
  const createDebt = useCreateDebt();
  const toast = useToast();
  const navigate = useNavigate();

  const handleClearFilters = () => {
    setFilters(initialFilters);
  };

  const handleOpenModal = () => {
    setAppointmentPrefill(undefined);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenModalFromSlot = (prefill: { professionalId: string; date: string; time: string }) => {
    setAppointmentPrefill(prefill);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
    setAppointmentPrefill(undefined);
  };

  const handleCreateAppointment = async (payload: CreateAppointmentPayload) => {
    setFormError(null);
    try {
      const response = await createAppointment.mutateAsync(payload) as any;
      handleCloseModal();
      toast.success('Agendamento criado', 'O agendamento foi criado com sucesso.');

      if (response?.payment?.pixData) {
        setPixModalData({
          pixData: response.payment.pixData,
          amount: response.totalPrice,
          description: `Agendamento: ${response.id}`,
          appointmentId: response.id,
        });
      } else if (response?.payment?.invoiceUrl) {
        window.location.href = response.payment.invoiceUrl;
        toast.success(
          'Link de pagamento',
          'Redirecionando para o Asaas para pagamento com cartão.',
        );
      }
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleAttend = async (id: string) => {
    try {
      await attend(id);
      toast.success('Status atualizado', 'Agendamento marcado como atendido.');
    } catch {
      toast.error('Erro', 'Não foi possível atualizar o status.');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancel(id);
      toast.info('Agendamento cancelado', 'O agendamento foi cancelado.');
    } catch {
      toast.error('Erro', 'Não foi possível cancelar o agendamento.');
    }
  };

  const handleNoShow = async (id: string) => {
    try {
      await noShow(id);
      toast.warning('Não compareceu', 'Agendamento marcado como não compareceu.');
    } catch {
      toast.error('Erro', 'Não foi possível atualizar o status.');
    }
  };

  const handleGenerateDebt = (appointment: Appointment) => {
    setDebtFormError(null);
    setDebtModalAppointment(appointment);
  };

  const handleCloseDebtModal = () => {
    setDebtModalAppointment(null);
    setDebtFormError(null);
  };

  const handleCreateDebt = async (payload: CreateDebtPayload) => {
    setDebtFormError(null);
    try {
      await createDebt.mutateAsync(payload);
      handleCloseDebtModal();
      toast.success('Dívida registrada', 'A dívida foi gerada a partir do agendamento.');
    } catch (err) {
      setDebtFormError(getApiErrorMessage(err));
    }
  };

  const debtPrefill = debtModalAppointment
    ? {
        clientId: debtModalAppointment.client?.id || '',
        appointmentId: debtModalAppointment.id,
        amount: debtModalAppointment.totalPrice,
        description: `Agendamento: ${(debtModalAppointment.services || []).map((s) => s.service?.name || 'Serviço').join(', ')}`,
      }
    : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <Calendar className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Agendamentos</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie todos os agendamentos da barbearia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex gap-1 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1">
            <button
              onClick={() => setActiveView('calendar')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeView === 'calendar'
                  ? 'bg-[#8B6914] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Calendário
            </button>
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeView === 'table'
                  ? 'bg-[#8B6914] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Table className="h-4 w-4" />
              Tabela
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/comandas?new=1')}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-bg)] focus:outline-none focus:ring-2 focus:ring-[#C8923A]"
            >
              <ClipboardList className="h-5 w-5" />
              Nova Comanda
            </button>
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
            >
              <Plus className="h-5 w-5" />
              Novo Agendamento
            </button>
          </div>
        </div>
      </div>

      {/* Modal de criação */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Novo Agendamento"
        size="lg"
      >
        <AppointmentForm
          key={appointmentPrefill ? `${appointmentPrefill.professionalId}-${appointmentPrefill.date}-${appointmentPrefill.time}` : 'default'}
          onSubmit={handleCreateAppointment}
          isLoading={createAppointment.isPending}
          error={formError}
          prefill={appointmentPrefill}
        />
      </Modal>

      {/* Modal de Gerar Dívida */}
      <Modal
        isOpen={!!debtModalAppointment}
        onClose={handleCloseDebtModal}
        title="Gerar Dívida"
        size="lg"
      >
        <DebtForm
          onSubmit={handleCreateDebt}
          isLoading={createDebt.isPending}
          error={debtFormError}
          prefill={debtPrefill}
        />
      </Modal>

      {/* Content based on active view */}
      {activeView === 'calendar' ? (
        <CalendarView onNewAppointment={handleOpenModalFromSlot} />
      ) : (
        <>
          {/* Filtros */}
          <AppointmentFiltersComponent
            filters={filters}
            professionals={professionals}
            onFilterChange={setFilters}
            onClear={handleClearFilters}
          />

          {/* Conteudo */}
          {isLoading ? (
            <SkeletonTable rows={5} cols={8} />
          ) : isError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-[#A63030]" />
                <div>
                  <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
                  <p className="text-sm text-[#C45050]">
                    {error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AppointmentsTable
              appointments={appointments || []}
              onAttend={handleAttend}
              onCancel={handleCancel}
              onNoShow={handleNoShow}
              onGenerateDebt={handleGenerateDebt}
              isLoading={isActionLoading}
              onNewAppointment={handleOpenModal}
            />
          )}
        </>
      )}
      {/* Modal do PIX */}
      <PixPaymentModal
        isOpen={!!pixModalData}
        onClose={() => setPixModalData(null)}
        onExpire={async () => {
          if (pixModalData?.appointmentId) {
            try {
              await cancel(pixModalData.appointmentId);
              toast.warning('PIX expirado', 'O prazo de pagamento venceu e o agendamento foi cancelado automaticamente.');
            } catch {
              // silently ignore
            }
          }
        }}
        pixData={pixModalData?.pixData}
        amount={pixModalData?.amount ?? 0}
        description={pixModalData?.description}
      />
    </div>
  );
}
