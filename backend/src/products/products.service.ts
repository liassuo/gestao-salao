import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateProductDto) {
    const { data: product, error } = await this.supabase
      .from('products')
      .insert({
        name: dto.name,
        description: dto.description,
        cost_price: dto.costPrice,
        sale_price: dto.salePrice,
        min_stock: dto.minStock ?? 0,
        branch_id: dto.branchId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return product;
  }

  async findAll(query: QueryProductDto) {
    let queryBuilder = this.supabase.from('products').select('*');

    if (query.all !== 'true') {
      queryBuilder = queryBuilder.eq('is_active', true);
    }

    if (query.branchId) {
      queryBuilder = queryBuilder.eq('branch_id', query.branchId);
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
      .select('id, name, cost_price, sale_price, min_stock')
      .eq('is_active', true);

    if (branchId) {
      queryBuilder = queryBuilder.eq('branch_id', branchId);
    }

    const { data: products, error } = await queryBuilder.order('name', { ascending: true });

    if (error) throw error;

    const stockData = [];
    for (const product of products || []) {
      const { data: movements } = await this.supabase
        .from('stock_movements')
        .select('type, quantity')
        .eq('product_id', product.id);

      const currentStock = (movements || []).reduce((acc, m) => {
        return m.type === 'ENTRY' ? acc + m.quantity : acc - m.quantity;
      }, 0);

      stockData.push({
        id: product.id,
        name: product.name,
        costPrice: product.cost_price,
        salePrice: product.sale_price,
        minStock: product.min_stock,
        currentStock,
        stockValue: currentStock * product.cost_price,
        potentialSaleValue: currentStock * product.sale_price,
        isLowStock: currentStock <= product.min_stock,
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
    if (dto.costPrice !== undefined) updateData.cost_price = dto.costPrice;
    if (dto.salePrice !== undefined) updateData.sale_price = dto.salePrice;
    if (dto.minStock !== undefined) updateData.min_stock = dto.minStock;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

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
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }
}
