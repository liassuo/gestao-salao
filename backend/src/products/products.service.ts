import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateProductDto) {
    const now = new Date().toISOString();
    const { data: product, error } = await this.supabase
      .from('products')
      .insert({
        id: crypto.randomUUID(),
        name: dto.name,
        description: dto.description,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        minStock: dto.minStock ?? 0,
        branchId: dto.branchId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;
    return product;
  }

  async findAll(query: QueryProductDto) {
    let queryBuilder = this.supabase.from('products').select('*');

    if (query.all !== 'true') {
      queryBuilder = queryBuilder.eq('isActive', true);
    }

    if (query.branchId) {
      queryBuilder = queryBuilder.eq('branchId', query.branchId);
    }

    if (query.search) {
      queryBuilder = queryBuilder.ilike('name', `%${query.search}%`);
    }

    const { data: products, error } = await queryBuilder.order('name', { ascending: true });

    if (error) throw error;
    return products || [];
  }

  async findOne(id: string) {
    const { data: product, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return product;
  }

  async getStock(branchId?: string) {
    let queryBuilder = this.supabase
      .from('products')
      .select('id, name, costPrice, salePrice, minStock')
      .eq('isActive', true);

    if (branchId) {
      queryBuilder = queryBuilder.eq('branchId', branchId);
    }

    const { data: products, error } = await queryBuilder.order('name', { ascending: true });

    if (error) throw error;

    const stockData = [];
    for (const product of products || []) {
      const { data: movements } = await this.supabase
        .from('stock_movements')
        .select('type, quantity')
        .eq('productId', product.id);

      const currentStock = (movements || []).reduce((acc, m) => {
        return m.type === 'ENTRY' ? acc + m.quantity : acc - m.quantity;
      }, 0);

      stockData.push({
        id: product.id,
        name: product.name,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        minStock: product.minStock,
        currentStock,
        stockValue: currentStock * product.costPrice,
        potentialSaleValue: currentStock * product.salePrice,
        isLowStock: currentStock <= product.minStock,
      });
    }

    return stockData;
  }

  async getLowStock(branchId?: string) {
    const stock = await this.getStock(branchId);
    return stock.filter((p) => p.isLowStock);
  }

  async update(id: string, dto: UpdateProductDto) {
    const { data: product, error: findError } = await this.supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.costPrice !== undefined) updateData.costPrice = dto.costPrice;
    if (dto.salePrice !== undefined) updateData.salePrice = dto.salePrice;
    if (dto.minStock !== undefined) updateData.minStock = dto.minStock;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const { data: updated, error } = await this.supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async remove(id: string) {
    const { data: product, error: findError } = await this.supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const { error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
