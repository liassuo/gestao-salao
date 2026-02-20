import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateClientDto, UpdateClientDto } from './dto';

export interface ClientFilters {
  search?: string;
  hasDebts?: boolean;
  isActive?: boolean;
}

@Injectable()
export class ClientsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateClientDto) {
    const { data: client, error } = await this.supabase
      .from('clients')
      .insert({
        name: dto.name,
        phone: dto.phone,
        email: dto.email || null,
        password: dto.password,
        google_id: dto.googleId,
        notes: dto.notes,
      })
      .select('id, name, phone, email, is_active, created_at')
      .single();

    if (error) throw error;
    return client;
  }

  async findAll(filters?: ClientFilters) {
    let query = this.supabase.from('clients').select('*');

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters?.hasDebts !== undefined) {
      query = query.eq('has_debts', filters.hasDebts);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }

    const { data: clients, error } = await query.order('name', { ascending: true });

    if (error) throw error;
    return clients || [];
  }

  async findOne(id: string) {
    const { data: client, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return client;
  }

  async findByEmail(email: string) {
    const { data: client } = await this.supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .single();

    return client;
  }

  async findClientsWithDebts() {
    const { data: clients, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('has_debts', true)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return clients || [];
  }

  async update(id: string, dto: UpdateClientDto) {
    const { data: client, error: findError } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const { data: updatedClient, error } = await this.supabase
      .from('clients')
      .update(dto)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updatedClient;
  }

  async remove(id: string) {
    const { data: client, error: findError } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const { error } = await this.supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }

  async updateDebtStatus(clientId: string) {
    const { count } = await this.supabase
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_settled', false);

    await this.supabase
      .from('clients')
      .update({ has_debts: (count || 0) > 0 })
      .eq('id', clientId);
  }
}
