import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateFinancialCategoryDto,
  UpdateFinancialCategoryDto,
  QueryFinancialCategoryDto,
} from './dto';

@Injectable()
export class FinancialCategoriesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateFinancialCategoryDto) {
    if (dto.parentId) {
      const { data: parent } = await this.supabase
        .from('financial_categories')
        .select('id')
        .eq('id', dto.parentId)
        .single();

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada');
      }
    }

    const { data: category, error } = await this.supabase
      .from('financial_categories')
      .insert({
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return category;
  }

  async findAll(query: QueryFinancialCategoryDto) {
    let queryBuilder = this.supabase.from('financial_categories').select('*');

    if (query.type) {
      queryBuilder = queryBuilder.eq('type', query.type);
    }

    if (query.parentId) {
      queryBuilder = queryBuilder.eq('parentId', query.parentId);
    }

    if (query.isActive !== undefined) {
      queryBuilder = queryBuilder.eq('isActive', query.isActive === 'true');
    }

    const { data: categories, error } = await queryBuilder.order('name', { ascending: true });

    if (error) throw error;
    return categories || [];
  }

  async findOne(id: string) {
    const { data: category, error } = await this.supabase
      .from('financial_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !category) {
      throw new NotFoundException('Categoria financeira não encontrada');
    }

    return category;
  }

  async update(id: string, dto: UpdateFinancialCategoryDto) {
    const { data: category, error: findError } = await this.supabase
      .from('financial_categories')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !category) {
      throw new NotFoundException('Categoria financeira não encontrada');
    }

    if (dto.parentId) {
      const { data: parent } = await this.supabase
        .from('financial_categories')
        .select('id')
        .eq('id', dto.parentId)
        .single();

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada');
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;

    const { data: updated, error } = await this.supabase
      .from('financial_categories')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async remove(id: string) {
    const { data: category, error: findError } = await this.supabase
      .from('financial_categories')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !category) {
      throw new NotFoundException('Categoria financeira não encontrada');
    }

    const { error } = await this.supabase.from('financial_categories').delete().eq('id', id);

    if (error) throw error;
  }
}
