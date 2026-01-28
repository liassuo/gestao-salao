import { useState } from 'react';
import { Calendar, AlertCircle, Plus } from 'lucide-react';
import {
  useAppointments,
  useAppointmentActions,
  useProfessionals,
  useCreateAppointment,
  getApiErrorMessage,
} from '@/hooks';
import {
  AppointmentFiltersComponent,
  AppointmentForm,
  AppointmentsTable,
} from '@/components/appointments';
import { Modal, SkeletonTable, useToast } from '@/components/ui';
import type { AppointmentFilters, CreateAppointmentPayload } from '@/types';

const initialFilters: AppointmentFilters = {};

export function Appointments() {
  const [filters, setFilters] = useState<AppointmentFilters>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: appointments, isLoading, isError, error } = useAppointments(filters);
  const { data: professionals = [] } = useProfessionals();
  const { attend, cancel, noShow, isLoading: isActionLoading } = useAppointmentActions();
  const createAppointment = useCreateAppointment();
  const toast = useToast();

  const handleClearFilters = () => {
    setFilters(initialFilters);
  };

  const handleOpenModal = () => {
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleCreateAppointment = async (payload: CreateAppointmentPayload) => {
    setFormError(null);
    try {
      await createAppointment.mutateAsync(payload);
      handleCloseModal();
      toast.success('Agendamento criado', 'O agendamento foi criado com sucesso.');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
            <Calendar className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Agendamentos</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie todos os agendamentos da barbearia
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Novo Agendamento
        </button>
      </div>

      {/* Modal de criação */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Novo Agendamento"
        size="lg"
      >
        <AppointmentForm
          onSubmit={handleCreateAppointment}
          isLoading={createAppointment.isPending}
          error={formError}
        />
      </Modal>

      {/* Filtros */}
      <AppointmentFiltersComponent
        filters={filters}
        professionals={professionals}
        onFilterChange={setFilters}
        onClear={handleClearFilters}
      />

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={8} />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-medium text-red-500">Erro ao carregar</h3>
              <p className="text-sm text-red-400">
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
          isLoading={isActionLoading}
          onNewAppointment={handleOpenModal}
        />
      )}
    </div>
  );
}
