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
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ClientsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateClientDto) {
<<<<<<< HEAD
    const { data: client, error } = await this.supabase
=======
    const { data, error } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('clients')
      .insert({
        name: dto.name,
        phone: dto.phone,
        email: dto.email || null,
        password: dto.password,
        google_id: dto.googleId,
        notes: dto.notes,
      })
<<<<<<< HEAD
      .select('id, name, phone, email, is_active, created_at')
      .single();

    if (error) throw error;
    return client;
=======
      .select('id, name, phone, email, isActive, createdAt')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }

  async findAll(filters?: ClientFilters) {
<<<<<<< HEAD
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
=======
    let query = this.supabase.client
      .from('clients')
      .select('id, name, phone, email, hasDebts, isActive, notes, createdAt');

    if (filters?.isActive !== undefined) {
      query = query.eq('isActive', filters.isActive);
    }

    if (filters?.hasDebts !== undefined) {
      query = query.eq('hasDebts', filters.hasDebts);
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`,
      );
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data;
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }

  async findOne(id: string) {
<<<<<<< HEAD
    const { data: client, error } = await this.supabase
      .from('clients')
      .select('*')
=======
    const { data: client, error } = await this.supabase.client
      .from('clients')
      .select(
        `
        id, name, phone, email, hasDebts, isActive, notes, createdAt, updatedAt,
        appointments:appointments(id, scheduledAt, status, totalPrice),
        debts:debts(id, amount, remainingBalance, createdAt)
      `,
      )
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .eq('id', id)
      .single();

    if (error || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return client;
  }

  async findByEmail(email: string) {
<<<<<<< HEAD
    const { data: client } = await this.supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .single();

    return client;
=======
    const { data } = await this.supabase.client
      .from('clients')
      .select('id, name, email, phone, password, googleId, isActive')
      .eq('email', email)
      .single();

    return data;
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }

  async findClientsWithDebts() {
<<<<<<< HEAD
    const { data: clients, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('has_debts', true)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return clients || [];
=======
    const { data, error } = await this.supabase.client
      .from('clients')
      .select(
        `
        id, name, phone, email,
        debts:debts(id, amount, remainingBalance, dueDate)
      `,
      )
      .eq('hasDebts', true)
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data;
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }

  async update(id: string, dto: UpdateClientDto) {
<<<<<<< HEAD
    const { data: client, error: findError } = await this.supabase
=======
    const { data: existingClient, error: findError } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

<<<<<<< HEAD
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
=======
    if (findError || !existingClient) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const { data, error } = await this.supabase.client
      .from('clients')
      .update({ ...dto, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, phone, email, isActive, notes, updatedAt')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }

  async remove(id: string) {
<<<<<<< HEAD
    const { data: client, error: findError } = await this.supabase
=======
    const { data: client, error: findError } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

<<<<<<< HEAD
    const { error } = await this.supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
=======
    const { error } = await this.supabase.client
      .from('clients')
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }

  async updateDebtStatus(clientId: string) {
<<<<<<< HEAD
    const { count } = await this.supabase
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_settled', false);

    await this.supabase
      .from('clients')
      .update({ has_debts: (count || 0) > 0 })
      .eq('id', clientId);
=======
    const { count } = await this.supabase.client
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('clientId', clientId)
      .eq('isSettled', false);

    const { error } = await this.supabase.client
      .from('clients')
      .update({
        hasDebts: (count ?? 0) > 0,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (error) {
      throw new Error(error.message);
    }
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }
}
