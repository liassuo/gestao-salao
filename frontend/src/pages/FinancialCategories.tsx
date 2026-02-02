import { useState } from 'react';
import { FolderTree, AlertCircle, Plus } from 'lucide-react';
import {
  useFinancialCategories,
  useCreateFinancialCategory,
  useUpdateFinancialCategory,
  useDeleteFinancialCategory,
  getApiErrorMessage,
} from '@/hooks';
import { FinancialCategoriesTable, FinancialCategoryForm } from '@/components/financial-categories';
import { Modal, ConfirmModal, SkeletonTable, useToast } from '@/components/ui';
import type {
  FinancialCategory,
  FinancialCategoryFilters,
  CreateFinancialCategoryPayload,
  UpdateFinancialCategoryPayload,
  TransactionType,
} from '@/types';

export function FinancialCategories() {
  const [filters, setFilters] = useState<FinancialCategoryFilters>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<FinancialCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: categories, isLoading, isError, error } = useFinancialCategories(filters);
  const createCategory = useCreateFinancialCategory();
  const updateCategory = useUpdateFinancialCategory();
  const deleteCategory = useDeleteFinancialCategory();
  const toast = useToast();

  const handleOpenCreateModal = () => {
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormError(null);
  };

  const handleOpenEditModal = (category: FinancialCategory) => {
    setFormError(null);
    setEditingCategory(category);
  };

  const handleCloseEditModal = () => {
    setEditingCategory(null);
    setFormError(null);
  };

  const handleCreateCategory = async (payload: CreateFinancialCategoryPayload) => {
    setFormError(null);
    try {
      await createCategory.mutateAsync(payload);
      handleCloseCreateModal();
      toast.success('Categoria cadastrada', 'A categoria foi cadastrada com sucesso.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdateCategory = async (payload: UpdateFinancialCategoryPayload) => {
    if (!editingCategory) return;
    setFormError(null);
    try {
      await updateCategory.mutateAsync({ id: editingCategory.id, payload });
      handleCloseEditModal();
      toast.success('Categoria atualizada', 'Os dados da categoria foram atualizados.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      await deleteCategory.mutateAsync(deletingCategory.id);
      setDeletingCategory(null);
      toast.success('Categoria excluída', 'A categoria foi desativada com sucesso.');
    } catch {
      toast.error('Erro', 'Não foi possível excluir a categoria.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
            <FolderTree className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Categorias Financeiras</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Gerencie as categorias de receitas e despesas
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Plus className="h-5 w-5" />
          Nova Categoria
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={filters.type || ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              type: e.target.value === '' ? undefined : (e.target.value as TransactionType),
            }))
          }
          className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        >
          <option value="">Todas</option>
          <option value="EXPENSE">Despesas</option>
          <option value="REVENUE">Receitas</option>
        </select>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-medium text-red-500">Erro ao carregar</h3>
              <p className="text-sm text-red-400">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <FinancialCategoriesTable
          categories={categories || []}
          onEdit={handleOpenEditModal}
          onDelete={setDeletingCategory}
          isLoading={deleteCategory.isPending}
          onNewCategory={handleOpenCreateModal}
        />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Nova Categoria"
      >
        <FinancialCategoryForm
          onSubmit={handleCreateCategory}
          isLoading={createCategory.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de edição */}
      <Modal
        isOpen={!!editingCategory}
        onClose={handleCloseEditModal}
        title="Editar Categoria"
      >
        <FinancialCategoryForm
          category={editingCategory}
          onSubmit={handleUpdateCategory as (payload: CreateFinancialCategoryPayload) => Promise<void>}
          isLoading={updateCategory.isPending}
          error={formError}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleDeleteCategory}
        title="Excluir Categoria"
        message={`Tem certeza que deseja excluir a categoria "${deletingCategory?.name}"? Esta ação irá desativá-la.`}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleteCategory.isPending}
      />
    </div>
  );
}
