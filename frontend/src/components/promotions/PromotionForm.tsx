import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useServices, useProducts, useUploadBanner } from '@/hooks';
import type { Promotion, CreatePromotionPayload } from '@/types';

interface PromotionFormProps {
  promotion?: Promotion | null;
  onSubmit: (payload: CreatePromotionPayload) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

interface FormData {
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  bannerTitle: string;
  bannerText: string;
  isTemplate: boolean;
}

function toLocalDateString(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 16);
}

export function PromotionForm({ promotion, onSubmit, isLoading, error }: PromotionFormProps) {
  const { data: allServices } = useServices();
  const { data: allProducts } = useProducts({ all: 'true' });
  const uploadBanner = useUploadBanner();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    promotion?.services.map((s) => s.id) || []
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    promotion?.products?.map((p) => p.id) || []
  );
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(
    promotion?.bannerImageUrl || null
  );
  const [bannerMode, setBannerMode] = useState<'upload' | 'text'>(
    promotion?.bannerImageUrl ? 'upload' : 'text'
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: promotion?.name || '',
      discountPercent: promotion?.discountPercent || 10,
      startDate: promotion?.startDate ? toLocalDateString(promotion.startDate) : '',
      endDate: promotion?.endDate ? toLocalDateString(promotion.endDate) : '',
      bannerTitle: promotion?.bannerTitle || '',
      bannerText: promotion?.bannerText || '',
      isTemplate: promotion?.isTemplate || false,
    },
  });

  useEffect(() => {
    if (promotion?.services) {
      setSelectedServiceIds(promotion.services.map((s) => s.id));
    }
    if (promotion?.products) {
      setSelectedProductIds(promotion.products.map((p) => p.id));
    }
  }, [promotion]);

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Imagem deve ter no maximo 5MB');
      return;
    }

    setUploadError(null);
    try {
      const result = await uploadBanner.mutateAsync(file);
      setBannerImageUrl(result.url);
    } catch {
      setUploadError('Erro ao fazer upload da imagem');
    }
  };

  const removeBanner = () => {
    setBannerImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFormSubmit = (data: FormData) => {
    const payload: CreatePromotionPayload = {
      name: data.name,
      discountPercent: data.discountPercent,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      isTemplate: data.isTemplate,
      serviceIds: selectedServiceIds,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
    };

    if (bannerMode === 'upload' && bannerImageUrl) {
      payload.bannerImageUrl = bannerImageUrl;
    } else if (bannerMode === 'text') {
      payload.bannerTitle = data.bannerTitle || undefined;
      payload.bannerText = data.bannerText || undefined;
    }

    onSubmit(payload);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[#C45050]">
          {error}
        </div>
      )}

      {/* Nome */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
          Nome da Promocao *
        </label>
        <input
          type="text"
          {...register('name', { required: 'Nome e obrigatorio' })}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
          placeholder="Ex: Promocao de Verao"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-[#C45050]">{errors.name.message}</p>
        )}
      </div>

      {/* Desconto */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
          Desconto (%) *
        </label>
        <input
          type="number"
          {...register('discountPercent', {
            required: 'Desconto e obrigatorio',
            min: { value: 1, message: 'Minimo 1%' },
            max: { value: 100, message: 'Maximo 100%' },
            valueAsNumber: true,
          })}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
          placeholder="20"
        />
        {errors.discountPercent && (
          <p className="mt-1 text-xs text-[#C45050]">{errors.discountPercent.message}</p>
        )}
      </div>

      {/* Periodo */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
            Data Inicio *
          </label>
          <input
            type="datetime-local"
            {...register('startDate', { required: 'Data inicio e obrigatoria' })}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
          />
          {errors.startDate && (
            <p className="mt-1 text-xs text-[#C45050]">{errors.startDate.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
            Data Fim *
          </label>
          <input
            type="datetime-local"
            {...register('endDate', { required: 'Data fim e obrigatoria' })}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
          />
          {errors.endDate && (
            <p className="mt-1 text-xs text-[#C45050]">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      {/* Servicos */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
          Servicos com Desconto
        </label>
        {selectedServiceIds.length === 0 && selectedProductIds.length === 0 && (
          <p className="mb-2 text-xs text-[#C45050]">Selecione pelo menos um servico ou produto</p>
        )}
        <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-2 space-y-1">
          {allServices?.map((service) => {
            const isSelected = selectedServiceIds.includes(service.id);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => toggleService(service.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'bg-[#C8923A]/20 text-[#C8923A] border border-[#C8923A]/30'
                    : 'text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                }`}
              >
                <span>{service.name}</span>
                <span className="text-xs text-[var(--text-muted)]">{formatPrice(service.price)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Produtos */}
      {allProducts && allProducts.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
            Produtos com Desconto
          </label>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-2 space-y-1">
            {allProducts.map((product) => {
              const isSelected = selectedProductIds.includes(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-[#C8923A]/20 text-[#C8923A] border border-[#C8923A]/30'
                      : 'text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                  }`}
                >
                  <span>{product.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{formatPrice(product.salePrice)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Banner Mode Toggle */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
          Banner da Promocao
        </label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setBannerMode('upload')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              bannerMode === 'upload'
                ? 'bg-[#C8923A]/20 text-[#C8923A] border border-[#C8923A]/30'
                : 'text-[var(--text-muted)] border border-[var(--border-color)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload de Arte
          </button>
          <button
            type="button"
            onClick={() => setBannerMode('text')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              bannerMode === 'text'
                ? 'bg-[#C8923A]/20 text-[#C8923A] border border-[#C8923A]/30'
                : 'text-[var(--text-muted)] border border-[var(--border-color)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Titulo e Texto
          </button>
        </div>

        {bannerMode === 'upload' && (
          <div className="space-y-2">
            {bannerImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-[var(--border-color)]">
                <img src={bannerImageUrl} alt="Banner" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={removeBanner}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-color)] bg-[var(--card-bg)] p-8 transition-colors hover:border-[#C8923A]"
              >
                <Upload className="mb-2 h-8 w-8 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-muted)]">Clique para enviar a arte</p>
                <p className="text-xs text-[var(--text-muted)]">PNG, JPG ate 5MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploadBanner.isPending && (
              <p className="text-xs text-[#C8923A]">Enviando imagem...</p>
            )}
            {uploadError && (
              <p className="text-xs text-[#C45050]">{uploadError}</p>
            )}
          </div>
        )}

        {bannerMode === 'text' && (
          <div className="space-y-3">
            <input
              type="text"
              {...register('bannerTitle')}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A]"
              placeholder="Titulo do banner"
            />
            <textarea
              {...register('bannerText')}
              rows={3}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#C8923A] focus:outline-none focus:ring-1 focus:ring-[#C8923A] resize-none"
              placeholder="Texto descritivo do banner"
            />
          </div>
        )}
      </div>

      {/* Salvar como template */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          {...register('isTemplate')}
          className="h-4 w-4 rounded border-[var(--border-color)] text-[#C8923A] focus:ring-[#C8923A]"
        />
        <span className="text-sm text-[var(--text-primary)]">Salvar como template reutilizavel</span>
      </label>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading || (selectedServiceIds.length === 0 && selectedProductIds.length === 0)}
          className="rounded-xl bg-[#8B6914] px-6 py-2.5 font-medium text-white transition-colors hover:bg-[#725510] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C8923A] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          {isLoading ? 'Salvando...' : promotion ? 'Atualizar' : 'Criar Promocao'}
        </button>
      </div>
    </form>
  );
}
