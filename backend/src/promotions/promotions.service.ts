import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly supabase: SupabaseService) {}

  private computeStatus(startDate: string, endDate: string, isActive: boolean): string {
    if (!isActive) return 'DISABLED';
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (now < start) return 'SCHEDULED';
    if (now > end) return 'EXPIRED';
    return 'ACTIVE';
  }

  async create(dto: CreatePromotionDto) {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('Data final deve ser posterior a data inicial');
    }

    const status = this.computeStatus(dto.startDate, dto.endDate, true);

    const now = new Date().toISOString();
    const { data: promotion, error } = await this.supabase
      .from('promotions')
      .insert({
        id: crypto.randomUUID(),
        name: dto.name,
        discountPercent: dto.discountPercent,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status,
        bannerImageUrl: dto.bannerImageUrl || null,
        bannerTitle: dto.bannerTitle || null,
        bannerText: dto.bannerText || null,
        isTemplate: dto.isTemplate || false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;

    if (dto.serviceIds?.length) {
      await this.syncServices(promotion.id, dto.serviceIds);
    }

    if (dto.productIds?.length) {
      await this.syncProducts(promotion.id, dto.productIds);
    }

    return this.findOne(promotion.id);
  }

  async findAll(filters?: { status?: string; isTemplate?: boolean }) {
    let query = this.supabase
      .from('promotions')
      .select('*, promotion_services(serviceId, service:services(id, name, price)), promotion_products(productId, product:products(id, name, salePrice))')
      .order('createdAt', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.isTemplate !== undefined) {
      query = query.eq('isTemplate', filters.isTemplate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((p) => this.formatPromotion(p));
  }

  async findTemplates() {
    const { data, error } = await this.supabase
      .from('promotions')
      .select('*, promotion_services(serviceId, service:services(id, name, price)), promotion_products(productId, product:products(id, name, salePrice))')
      .eq('isTemplate', true)
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map((p) => this.formatPromotion(p));
  }

  async findActive() {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('promotions')
      .select('*, promotion_services(serviceId, service:services(id, name, price)), promotion_products(productId, product:products(id, name, salePrice))')
      .eq('isActive', true)
      .eq('status', 'ACTIVE')
      .lte('startDate', now)
      .gte('endDate', now);

    if (error) throw error;
    return (data || []).map((p) => this.formatPromotion(p));
  }

  async findOne(id: string) {
    const { data: promotion, error } = await this.supabase
      .from('promotions')
      .select('*, promotion_services(serviceId, service:services(id, name, price, duration)), promotion_products(productId, product:products(id, name, salePrice))')
      .eq('id', id)
      .single();

    if (error || !promotion) {
      throw new NotFoundException('Promocao nao encontrada');
    }

    return this.formatPromotion(promotion);
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const existing = await this.findOne(id);

    if (dto.endDate && dto.startDate && new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('Data final deve ser posterior a data inicial');
    }

    const startDate = dto.startDate || existing.startDate;
    const endDate = dto.endDate || existing.endDate;
    const isActive = dto.isActive !== undefined ? dto.isActive : existing.isActive;
    const status = this.computeStatus(startDate, endDate, isActive);

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString(), status };
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.discountPercent !== undefined) updateData.discountPercent = dto.discountPercent;
    if (dto.startDate !== undefined) updateData.startDate = dto.startDate;
    if (dto.endDate !== undefined) updateData.endDate = dto.endDate;
    if (dto.bannerImageUrl !== undefined) updateData.bannerImageUrl = dto.bannerImageUrl;
    if (dto.bannerTitle !== undefined) updateData.bannerTitle = dto.bannerTitle;
    if (dto.bannerText !== undefined) updateData.bannerText = dto.bannerText;
    if (dto.isTemplate !== undefined) updateData.isTemplate = dto.isTemplate;

    const { error } = await this.supabase
      .from('promotions')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    if (dto.serviceIds) {
      await this.syncServices(id, dto.serviceIds);
    }

    if (dto.productIds) {
      await this.syncProducts(id, dto.productIds);
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const { data, error: findError } = await this.supabase
      .from('promotions')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !data) {
      throw new NotFoundException('Promocao nao encontrada');
    }

    const { error } = await this.supabase
      .from('promotions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async cloneFromTemplate(templateId: string, overrides: Partial<CreatePromotionDto>) {
    const template = await this.findOne(templateId);

    const dto: CreatePromotionDto = {
      name: overrides.name || `${template.name} (copia)`,
      discountPercent: overrides.discountPercent ?? template.discountPercent,
      startDate: overrides.startDate || new Date().toISOString(),
      endDate: overrides.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      bannerImageUrl: overrides.bannerImageUrl ?? template.bannerImageUrl,
      bannerTitle: overrides.bannerTitle ?? template.bannerTitle,
      bannerText: overrides.bannerText ?? template.bannerText,
      isTemplate: false,
      serviceIds: overrides.serviceIds || template.services.map((s: any) => s.id),
      productIds: overrides.productIds || template.products?.map((p: any) => p.id) || [],
    };

    return this.create(dto);
  }

  async uploadBanner(file: Express.Multer.File) {
    const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    const { data, error } = await this.supabase.client.storage
      .from('promotion-banners')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = this.supabase.client.storage
      .from('promotion-banners')
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl };
  }

  async deleteBanner(url: string) {
    const path = url.split('/promotion-banners/')[1];
    if (!path) return;

    await this.supabase.client.storage
      .from('promotion-banners')
      .remove([path]);
  }

  private async syncProducts(promotionId: string, productIds: string[]) {
    await this.supabase
      .from('promotion_products')
      .delete()
      .eq('promotionId', promotionId);

    if (productIds.length > 0) {
      const rows = productIds.map((productId) => ({
        id: crypto.randomUUID(),
        promotionId,
        productId,
      }));

      const { error } = await this.supabase
        .from('promotion_products')
        .insert(rows);

      if (error) throw error;
    }
  }

  private async syncServices(promotionId: string, serviceIds: string[]) {
    // Remove servicos existentes
    await this.supabase
      .from('promotion_services')
      .delete()
      .eq('promotionId', promotionId);

    // Insere novos
    if (serviceIds.length > 0) {
      const rows = serviceIds.map((serviceId) => ({
        id: crypto.randomUUID(),
        promotionId,
        serviceId,
      }));

      const { error } = await this.supabase
        .from('promotion_services')
        .insert(rows);

      if (error) throw error;
    }
  }

  private formatPromotion(raw: any) {
    const services = (raw.promotion_services || []).map((ps: any) => ({
      id: ps.service?.id || ps.serviceId,
      name: ps.service?.name,
      price: ps.service?.price,
      duration: ps.service?.duration,
    }));

    const products = (raw.promotion_products || []).map((pp: any) => ({
      id: pp.product?.id || pp.productId,
      name: pp.product?.name,
      salePrice: pp.product?.salePrice,
    }));

    return {
      id: raw.id,
      name: raw.name,
      discountPercent: raw.discountPercent,
      startDate: raw.startDate,
      endDate: raw.endDate,
      status: raw.status,
      bannerImageUrl: raw.bannerImageUrl,
      bannerTitle: raw.bannerTitle,
      bannerText: raw.bannerText,
      isTemplate: raw.isTemplate,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      services,
      products,
    };
  }
}
