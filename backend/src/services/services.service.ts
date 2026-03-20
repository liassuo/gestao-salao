import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class ServicesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateServiceDto) {
    const now = new Date().toISOString();
    const { data: service, error } = await this.supabase
      .from('services')
      .insert({
        id: crypto.randomUUID(),
        name: dto.name,
        description: dto.description,
        price: dto.price,
        duration: dto.duration,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('id, name, description, price, duration, isActive, createdAt')
      .single();

    if (error) throw error;
    return service;
  }

  async findAll(activeOnly: boolean = true) {
    let query = this.supabase
      .from('services')
      .select('id, name, description, price, duration, isActive')
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('isActive', true);
    }

    const { data: services, error } = await query;

    if (error) throw error;
    return services || [];
  }

  async findActive() {
    const { data: services, error } = await this.supabase
      .from('services')
      .select('id, name, description, price, duration')
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return services || [];
  }

  async findOne(id: string) {
    const { data: service, error } = await this.supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    return service;
  }

  async findByIds(ids: string[]) {
    const { data: services, error } = await this.supabase
      .from('services')
      .select('id, name, price, duration')
      .in('id', ids)
      .eq('isActive', true);

    if (error) throw error;
    return services || [];
  }

  async calculateTotal(
    serviceIds: string[],
  ): Promise<{ totalPrice: number; totalDuration: number }> {
    const { data: services, error } = await this.supabase
      .from('services')
      .select('price, duration')
      .in('id', serviceIds)
      .eq('isActive', true);

    if (error) throw error;

    return (services || []).reduce(
      (acc, service) => ({
        totalPrice: acc.totalPrice + service.price,
        totalDuration: acc.totalDuration + service.duration,
      }),
      { totalPrice: 0, totalDuration: 0 },
    );
  }

  async update(id: string, dto: UpdateServiceDto) {
    const { data: service, error: findError } = await this.supabase
      .from('services')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const { data: updatedService, error } = await this.supabase
      .from('services')
      .update(dto)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updatedService;
  }

  async remove(id: string) {
    const { data: service, error: findError } = await this.supabase
      .from('services')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const { error } = await this.supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getStatistics(id: string) {
    const { data: service, error } = await this.supabase
      .from('services')
      .select('id, name, price')
      .eq('id', id)
      .single();

    if (error || !service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    return {
      ...service,
      attendedCount: 0,
      totalRevenue: 0,
    };
  }
}
