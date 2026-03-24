import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreatePaymentMethodConfigDto,
  UpdatePaymentMethodConfigDto,
  QueryPaymentMethodConfigDto,
} from './dto';

@Injectable()
export class PaymentMethodConfigService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreatePaymentMethodConfigDto) {
    const now = new Date().toISOString();
    const { data: config, error } = await this.supabase
      .from('payment_method_configs')
      .insert({
        id: randomUUID(),
        name: dto.name,
        type: dto.type,
        scope: dto.scope,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;
    return config;
  }

  async findAll(query: QueryPaymentMethodConfigDto) {
    let queryBuilder = this.supabase.from('payment_method_configs').select('*');

    if (query.scope) {
      queryBuilder = queryBuilder.eq('scope', query.scope);
    }

    if (query.type) {
      queryBuilder = queryBuilder.eq('type', query.type);
    }

    if (query.isActive !== undefined) {
      queryBuilder = queryBuilder.eq('isActive', query.isActive === 'true');
    }

    const { data: configs, error } = await queryBuilder.order('name', { ascending: true });

    if (error) throw error;
    return configs || [];
  }

  async findOne(id: string) {
    const { data: config, error } = await this.supabase
      .from('payment_method_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !config) {
      throw new NotFoundException('Forma de pagamento não encontrada');
    }

    return config;
  }

  async findByScope(scope: string) {
    const { data: configs, error } = await this.supabase
      .from('payment_method_configs')
      .select('*')
      .eq('isActive', true)
      .or(`scope.eq.${scope},scope.eq.BOTH`)
      .order('name', { ascending: true });

    if (error) throw error;
    return configs || [];
  }

  async update(id: string, dto: UpdatePaymentMethodConfigDto) {
    const { data: config, error: findError } = await this.supabase
      .from('payment_method_configs')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !config) {
      throw new NotFoundException('Forma de pagamento não encontrada');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.scope !== undefined) updateData.scope = dto.scope;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const { data: updated, error } = await this.supabase
      .from('payment_method_configs')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async remove(id: string) {
    const { data: config, error: findError } = await this.supabase
      .from('payment_method_configs')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !config) {
      throw new NotFoundException('Forma de pagamento não encontrada');
    }

    const { error } = await this.supabase
      .from('payment_method_configs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
