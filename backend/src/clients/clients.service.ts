import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateClientDto, UpdateClientDto } from './dto';

export interface ClientFilters {
  search?: string;
  hasDebts?: boolean;
  isActive?: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  password: string | null;
  googleId: string | null;
  hasDebts: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
        googleId: dto.googleId,
        notes: dto.notes,
      })
      .select('id, name, phone, email, isActive, createdAt')
      .single();

    if (error) throw error;
    return client;
  }

  async findAll(filters?: ClientFilters) {
    let query = this.supabase
      .from('clients')
      .select('*, appointment_count:appointments(count), debt_count:debts(count)');

    if (filters?.isActive !== undefined) {
      query = query.eq('isActive', filters.isActive);
    }

    if (filters?.hasDebts !== undefined) {
      query = query.eq('hasDebts', filters.hasDebts);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }

    const { data: clients, error } = await query.order('name', { ascending: true });

    if (error) throw error;

    // Transformar para o formato _count que o frontend espera
    return (clients || []).map(({ appointment_count, debt_count, ...client }: any) => ({
      ...client,
      _count: {
        appointments: appointment_count?.[0]?.count || 0,
        debts: debt_count?.[0]?.count || 0,
      },
    }));
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
      .eq('hasDebts', true)
      .eq('isActive', true)
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
      .update({ isActive: false })
      .eq('id', id);

    if (error) throw error;
  }

  async updateDebtStatus(clientId: string) {
    const { count } = await this.supabase
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('clientId', clientId)
      .eq('isSettled', false);

    await this.supabase
      .from('clients')
      .update({ hasDebts: (count || 0) > 0 })
      .eq('id', clientId);
  }
}
