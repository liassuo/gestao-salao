import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateProductDto) {
    const now = new Date().toISOString();
    const { data: existing } = await this.supabase
      .from('products')
      .select('id')
      .ilike('name', dto.name)
      .eq('isActive', true)
      .eq('branchId', dto.branchId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Já existe um produto ativo com este nome nesta filial');
    }

    const { data: product, error } = await this.supabase
      .from('products')
      .insert({
        id: randomUUID(),
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

    if (query.isActive !== undefined) {
      queryBuilder = queryBuilder.eq('isActive', query.isActive === 'true');
    } else if (query.all !== 'true') {
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
      .select(`
        id, 
        name, 
        costPrice, 
        salePrice, 
        minStock,
        stock_movements (
          type,
          quantity
        )
      `)
      .eq('isActive', true);

    if (branchId) {
      queryBuilder = queryBuilder.eq('branchId', branchId);
    }

    const { data: products, error } = await queryBuilder.order('name', { ascending: true });

    if (error) throw error;

    return (products || []).map((product: any) => {
      const currentStock = (product.stock_movements || []).reduce((acc: number, m: any) => {
        return m.type === 'ENTRY' ? acc + m.quantity : acc - m.quantity;
      }, 0);

      return {
        id: product.id,
        name: product.name,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        minStock: product.minStock,
        currentStock,
        stockValue: currentStock * product.costPrice,
        potentialSaleValue: currentStock * product.salePrice,
        isLowStock: currentStock <= product.minStock,
      };
    });
  }

  async getLowStock(branchId?: string) {
    const stock = await this.getStock(branchId);
    return stock.filter((p) => p.isLowStock);
  }

  async update(id: string, dto: UpdateProductDto) {
    const { data: product, error: findError } = await this.supabase
      .from('products')
      .select('id, branchId')
      .eq('id', id)
      .single();

    if (findError || !product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const updateData: any = {};
    if (dto.name !== undefined) {
      const { data: existing } = await this.supabase
        .from('products')
        .select('id')
        .ilike('name', dto.name)
        .eq('isActive', true)
        .eq('branchId', dto.branchId || product.branchId)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new BadRequestException('Já existe outro produto ativo com este nome nesta filial');
      }
      updateData.name = dto.name;
    }
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
      .update({ isActive: false })
      .eq('id', id);

    if (error) throw error;
  }

  async hardDelete(id: string) {
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
