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

  /**
   * Create a new client
   */
  async create(dto: CreateClientDto) {
    const { data, error } = await this.supabase.client
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

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Find all clients with optional filters
   */
  async findAll(filters?: ClientFilters) {
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
  }

  /**
   * Find client by ID with details
   */
  async findOne(id: string) {
    const { data: client, error } = await this.supabase.client
      .from('clients')
      .select(
        `
        id, name, phone, email, hasDebts, isActive, notes, createdAt, updatedAt,
        appointments:appointments(id, scheduledAt, status, totalPrice),
        debts:debts(id, amount, remainingBalance, createdAt)
      `,
      )
      .eq('id', id)
      .single();

    if (error || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return client;
  }

  /**
   * Find client by email (for authentication)
   */
  async findByEmail(email: string) {
    const { data } = await this.supabase.client
      .from('clients')
      .select('id, name, email, phone, password, googleId, isActive')
      .eq('email', email)
      .single();

    return data;
  }

  /**
   * Find clients with active debts
   */
  async findClientsWithDebts() {
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
  }

  /**
   * Update client information
   */
  async update(id: string, dto: UpdateClientDto) {
    const { data: existingClient, error: findError } = await this.supabase.client
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

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
  }

  /**
   * Soft delete client
   */
  async remove(id: string) {
    const { data: client, error: findError } = await this.supabase.client
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const { error } = await this.supabase.client
      .from('clients')
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Update hasDebts flag for a client
   * Should be called when debts are created, paid, or settled
   */
  async updateDebtStatus(clientId: string) {
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
  }
}
