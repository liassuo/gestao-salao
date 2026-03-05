import { useState, useMemo } from 'react';
import { Tag, AlertCircle, Plus, Search, LayoutTemplate, Zap, Clock, Archive } from 'lucide-react';
import {
  usePromotions,
  useCreatePromotion,
  useUpdatePromotion,
  useDeletePromotion,
  useClonePromotion,
  getApiErrorMessage,
} from '@/hooks';
import {
  PromotionsTable,
  PromotionForm,
  TemplateSelector,
  ConfirmDeleteModal,
} from '@/components/promotions';
import { Modal, SkeletonTable, useToast } from '@/components/ui';
import type { Promotion, CreatePromotionPayload, UpdatePromotionPayload } from '@/types';

type Tab = 'active' | 'templates' | 'past';

const tabs: { key: Tab; label: string; icon: typeof Zap }[] = [
  { key: 'active', label: 'Ativas', icon: Zap },
  { key: 'templates', label: 'Modelos', icon: LayoutTemplate },
  { key: 'past', label: 'Passadas', icon: Archive },
];

export function Promotions() {
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null);
  const [templateForCreate, setTemplateForCreate] = useState<Promotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: promotions, isLoading, isError, error } = usePromotions();
  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion();
  const deletePromotion = useDeletePromotion();
  const clonePromotion = useClonePromotion();
  const toast = useToast();

  const { activePromotions, templatePromotions, pastPromotions } = useMemo(() => {
    if (!promotions) return { activePromotions: [], templatePromotions: [], pastPromotions: [] };

    const applySearch = (list: Promotion[]) => {
      if (!searchTerm) return list;
      const term = searchTerm.toLowerCase();
      return list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.services.some((s) => s.name.toLowerCase().includes(term))
      );
    };

    return {
      activePromotions: applySearch(
        promotions.filter((p) => p.status === 'ACTIVE' || p.status === 'SCHEDULED')
      ),
      templatePromotions: applySearch(
        promotions.filter((p) => p.isTemplate)
      ),
      pastPromotions: applySearch(
        promotions.filter((p) => p.status === 'EXPIRED' || p.status === 'DISABLED')
      ),
    };
  }, [promotions, searchTerm]);

  const currentList = activeTab === 'active'
    ? activePromotions
    : activeTab === 'templates'
    ? templatePromotions
    : pastPromotions;

  const counts = {
    active: activePromotions.length,
    templates: templatePromotions.length,
    past: pastPromotions.length,
  };

  const handleOpenCreate = () => {
    setFormError(null);
    setTemplateForCreate(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenFromTemplate = () => {
    setIsTemplateModalOpen(true);
  };

  const handleSelectTemplate = (template: Promotion) => {
    setIsTemplateModalOpen(false);
    setTemplateForCreate(template);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreate = () => {
    setIsCreateModalOpen(false);
    setTemplateForCreate(null);
    setFormError(null);
  };

  const handleOpenEdit = (promotion: Promotion) => {
    setFormError(null);
    setEditingPromotion(promotion);
  };

  const handleCloseEdit = () => {
    setEditingPromotion(null);
    setFormError(null);
  };

  const handleCreate = async (payload: CreatePromotionPayload) => {
    setFormError(null);
    try {
      await createPromotion.mutateAsync(payload);
      handleCloseCreate();
      toast.success('Promocao criada', 'A promocao foi criada com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdate = async (payload: UpdatePromotionPayload) => {
    if (!editingPromotion) return;
    setFormError(null);
    try {
      await updatePromotion.mutateAsync({ id: editingPromotion.id, payload });
      handleCloseEdit();
      toast.success('Promocao atualizada', 'Os dados da promocao foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingPromotion) return;
    try {
      await deletePromotion.mutateAsync(deletingPromotion.id);
      setDeletingPromotion(null);
      toast.success('Promocao excluida', 'A promocao foi desativada com sucesso.');
    } catch {
      toast.error('Erro', 'Nao foi possivel excluir a promocao.');
    }
  };

  const handleToggleActive = async (promotion: Promotion) => {
    try {
      const newActive = !promotion.isActive;
      await updatePromotion.mutateAsync({
        id: promotion.id,
        payload: { isActive: newActive },
      });
      toast.success(
        newActive ? 'Promocao ativada' : 'Promocao desativada',
        newActive ? 'A promocao esta ativa novamente.' : 'A promocao foi desativada.',
      );
    } catch {
      toast.error('Erro', 'Nao foi possivel alterar o status da promocao.');
    }
  };

  const handleClone = async (promotion: Promotion) => {
    try {
      await clonePromotion.mutateAsync({
        templateId: promotion.id,
        overrides: { name: `${promotion.name} (copia)` },
      });
      toast.success('Promocao duplicada', 'Uma copia da promocao foi criada.');
    } catch {
      toast.error('Erro', 'Nao foi possivel duplicar a promocao.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8923A]/20">
            <Tag className="h-5 w-5 text-[#C8923A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Promocoes</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie promocoes e descontos para seus servicos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenFromTemplate}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-bg)] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            <LayoutTemplate className="h-5 w-5" />
            Usar Modelo
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            <Plus className="h-5 w-5" />
            Nova Promocao
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[var(--border-color)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-[#C8923A] text-[#C8923A]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    isActive
                      ? 'bg-[#C8923A]/20 text-[#C8923A]'
                      : 'bg-[var(--hover-bg)] text-[var(--text-muted)]'
                  }`}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome ou servico..."
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] transition-colors"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-[#A63030]" />
            <div>
              <h3 className="font-medium text-[#A63030]">Erro ao carregar</h3>
              <p className="text-sm text-[#C45050]">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <PromotionsTable
          promotions={currentList}
          onEdit={handleOpenEdit}
          onDelete={setDeletingPromotion}
          onClone={handleClone}
          onToggleActive={handleToggleActive}
          onNewPromotion={handleOpenCreate}
          isLoading={deletePromotion.isPending || updatePromotion.isPending}
        />
      )}

      {/* Modal: Template Selector */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Selecionar Modelo"
      >
        <TemplateSelector
          onSelect={handleSelectTemplate}
          onClose={() => {
            setIsTemplateModalOpen(false);
            handleOpenCreate();
          }}
        />
      </Modal>

      {/* Modal: Create */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreate}
        title="Nova Promocao"
        size="lg"
      >
        <PromotionForm
          promotion={templateForCreate}
          onSubmit={handleCreate}
          isLoading={createPromotion.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal: Edit */}
      <Modal
        isOpen={!!editingPromotion}
        onClose={handleCloseEdit}
        title="Editar Promocao"
        size="lg"
      >
        <PromotionForm
          promotion={editingPromotion}
          onSubmit={handleUpdate as (payload: CreatePromotionPayload) => Promise<void>}
          isLoading={updatePromotion.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal: Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={!!deletingPromotion}
        onClose={() => setDeletingPromotion(null)}
        onConfirm={handleDelete}
        promotion={deletingPromotion}
        isLoading={deletePromotion.isPending}
      />
    </div>
  );
}
