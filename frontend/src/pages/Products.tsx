import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Package, Plus, AlertCircle, Search } from 'lucide-react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getApiErrorMessage } from '@/hooks';
import { ProductForm, ProductsTable, ConfirmDeleteModal } from '@/components/products';
import { Modal, useToast } from '@/components/ui';
import type { Product, CreateProductPayload, UpdateProductPayload } from '@/types';
import { productsService } from '@/services/products';

export function Products() {
  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: products, isLoading, error } = useProducts({
    isActive: tab === 'active' ? 'true' : 'false',
  });

  const filteredProducts = useMemo(() => {
    if (!products || !searchTerm) return products || [];
    const term = searchTerm.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);
  const queryClient = useQueryClient();
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
      if (tab === 'inactive') {
        await productsService.permanentDelete(deletingProduct.id);
        queryClient.invalidateQueries({ queryKey: ['products'] });
        toast.success('Produto excluído permanentemente');
        setDeletingProduct(null);
      } else {
        await deleteProduct.mutateAsync(deletingProduct.id);
        toast.success('Produto desativado com sucesso');
        setDeletingProduct(null);
      }
    } catch (err) {
      toast.error('Erro', getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B6914]"><Package className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Produtos</h1>
            <p className="text-sm text-[var(--text-muted)]">Cadastro de produtos</p>
          </div>
        </div>
        {tab === 'active' && (
          <button onClick={() => { setFormError(null); setIsCreateModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-[#8B6914] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#725510]">
            <Plus className="h-4 w-4" /> Novo Produto
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1 w-fit">
        <button onClick={() => setTab('active')} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'active' ? 'bg-[#8B6914] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
          Ativos
        </button>
        <button onClick={() => setTab('inactive')} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'inactive' ? 'bg-[#8B6914] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
          Inativos
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] transition-colors"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 backdrop-blur-sm">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8923A] border-t-transparent" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-[#C45050]"><AlertCircle className="h-5 w-5" /><span>Erro ao carregar produtos</span></div>
        ) : tab === 'inactive' && (!filteredProducts || filteredProducts.length === 0) ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-50" />
            <h3 className="mt-4 text-lg font-medium text-[var(--text-primary)]">Nenhum registro inativo</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Não há produtos inativos no momento.</p>
          </div>
        ) : (
          <ProductsTable products={filteredProducts} onEdit={(p) => { setFormError(null); setEditingProduct(p); }} onDelete={setDeletingProduct} />
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
