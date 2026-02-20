import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateStockMovementDto, QueryStockMovementDto } from './dto';

@Injectable()
export class StockService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateStockMovementDto) {
    const { data: product, error: prodError } = await this.supabase
      .from('products')
      .select('id')
      .eq('id', dto.productId)
      .single();

    if (prodError || !product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if (dto.type === 'EXIT') {
      const { data: movements } = await this.supabase
        .from('stock_movements')
        .select('type, quantity')
        .eq('product_id', dto.productId);

      const currentStock = (movements || []).reduce((acc, m) => {
        return m.type === 'ENTRY' ? acc + m.quantity : acc - m.quantity;
      }, 0);

      if (currentStock < dto.quantity) {
        throw new BadRequestException(`Estoque insuficiente. Estoque atual: ${currentStock}`);
      }
    }

    const { data: movement, error } = await this.supabase
      .from('stock_movements')
      .insert({
        product_id: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason,
        branch_id: dto.branchId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return movement;
  }

  async findAll(query: QueryStockMovementDto) {
    let queryBuilder = this.supabase.from('stock_movements').select('*');

    if (query.productId) {
      queryBuilder = queryBuilder.eq('product_id', query.productId);
    }

    if (query.type) {
      queryBuilder = queryBuilder.eq('type', query.type);
    }

    if (query.branchId) {
      queryBuilder = queryBuilder.eq('branch_id', query.branchId);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('created_at', new Date(query.startDate).toISOString());
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('created_at', new Date(query.endDate + 'T23:59:59.999Z').toISOString());
    }

    const { data: movements, error } = await queryBuilder.order('created_at', { ascending: false });

    if (error) throw error;
    return movements || [];
  }

  async findOne(id: string) {
    const { data: movement, error } = await this.supabase
      .from('stock_movements')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !movement) {
      throw new NotFoundException('Movimentação não encontrada');
    }

    return movement;
  }
}
