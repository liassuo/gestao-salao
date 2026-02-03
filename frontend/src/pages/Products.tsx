import { useState } from 'react';
import { Package, Plus, AlertCircle } from 'lucide-react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getApiErrorMessage } from '@/hooks';
import { ProductForm, ProductsTable, ConfirmDeleteModal } from '@/components/products';
import { Modal, useToast } from '@/components/ui';
import type { Product, CreateProductPayload, UpdateProductPayload } from '@/types';

export function Products() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: products, isLoading, error } = useProducts({ all: 'true' });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const toast = useToast();

  const handleCreate = async (payload: CreateProductPayload) => {
    try {
      setFormError(null);
      await createProduct.mutateAsync(payload);
      toast.success('Produto criado com sucesso');
      setIsCreateModalOpen(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleUpdate = async (payload: CreateProductPayload) => {
    if (!editingProduct) return;
    try {
      setFormError(null);
      await updateProduct.mutateAsync({ id: editingProduct.id, payload: payload as UpdateProductPayload });
      toast.success('Produto atualizado com sucesso');
      setEditingProduct(null);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    try {
      await deleteProduct.mutateAsync(deletingProduct.id);
      toast.success('Produto desativado com sucesso');
      setDeletingProduct(null);
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><Package className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Produtos</h1>
            <p className="text-sm text-[var(--text-muted)]">Cadastro de produtos</p>
          </div>
        </div>
        <button onClick={() => { setFormError(null); setIsCreateModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400"><AlertCircle className="h-5 w-5" /><span>Erro ao carregar produtos</span></div>
        ) : (
          <ProductsTable products={products || []} onEdit={(p) => { setFormError(null); setEditingProduct(p); }} onDelete={setDeletingProduct} />
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Novo Produto">
        <ProductForm onSubmit={handleCreate} isLoading={createProduct.isPending} error={formError} />
      </Modal>

      <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title="Editar Produto">
        {editingProduct && <ProductForm product={editingProduct} onSubmit={handleUpdate} isLoading={updateProduct.isPending} error={formError} />}
      </Modal>

      {deletingProduct && (
        <ConfirmDeleteModal product={deletingProduct} isOpen={!!deletingProduct} isLoading={deleteProduct.isPending} onConfirm={handleDelete} onClose={() => setDeletingProduct(null)} />
      )}
    </div>
  );
}
