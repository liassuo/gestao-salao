import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
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
  cpf: string | null;
  password: string | null;
  googleId: string | null;
  hasDebts: boolean;
  isActive: boolean;
  birthDate: string | null;
  address: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lastVisitAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
  ) {}

  async create(dto: CreateClientDto) {
    const now = new Date().toISOString();
    const { data: client, error } = await this.supabase
      .from('clients')
      .insert({
        id: crypto.randomUUID(),
        name: dto.name,
        phone: dto.phone,
        email: dto.email || null,
        cpf: dto.cpf || null,
        password: dto.password,
        googleId: dto.googleId,
        birthDate: dto.birthDate || null,
        address: dto.address || null,
        addressNumber: dto.addressNumber || null,
        neighborhood: dto.neighborhood || null,
        city: dto.city || null,
        state: dto.state || null,
        notes: dto.notes,
        hasDebts: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Sincronizar com Asaas (sem bloquear o fluxo principal)
    if (this.asaasService.configured && client) {
      try {
        const asaasCustomer = await this.asaasService.createCustomer({
          name: dto.name,
          email: dto.email || undefined,
          mobilePhone: dto.phone || undefined,
          cpfCnpj: dto.cpf || undefined,
          externalReference: client.id,
        });
        await this.supabase
          .from('clients')
          .update({ asaasCustomerId: asaasCustomer.id })
          .eq('id', client.id);
        this.logger.log(`Cliente sincronizado com Asaas: ${asaasCustomer.id}`);
      } catch (syncError) {
        this.logger.warn(`Falha ao sincronizar cliente com Asaas: ${syncError}`);
      }
    }

    return client;
  }

  async findAll(filters?: ClientFilters) {
    let query = this.supabase
      .from('clients')
      .select('*, appointment_count:appointments(count), debt_count:debts(count)');

    if (filters?.isActive !== undefined) {
      query = query.eq('isActive', filters.isActive);
    } else {
      query = query.eq('isActive', true);
    }

    if (filters?.hasDebts !== undefined) {
      query = query.eq('hasDebts', filters.hasDebts);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,cpf.ilike.%${filters.search}%`);
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

    // Sincronizar com Asaas (se já tem asaasCustomerId)
    if (this.asaasService.configured && updatedClient?.asaasCustomerId) {
      try {
        await this.asaasService.updateCustomer(updatedClient.asaasCustomerId, {
          name: dto.name || updatedClient.name,
          email: dto.email || updatedClient.email || undefined,
          mobilePhone: dto.phone || updatedClient.phone || undefined,
          cpfCnpj: dto.cpf || updatedClient.cpf || undefined,
        });
      } catch (syncError) {
        this.logger.warn(`Falha ao atualizar cliente no Asaas: ${syncError}`);
      }
    }

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

  async hardDelete(id: string) {
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
      .delete()
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

  /**
   * Sincroniza um cliente com o Asaas manualmente.
   */
  async syncWithAsaas(clientId: string) {
    const client = await this.findOne(clientId);

    if (!this.asaasService.configured) {
      throw new Error('Integração Asaas não está configurada');
    }

    const payload = {
      name: client.name,
      email: client.email || undefined,
      mobilePhone: client.phone || undefined,
      externalReference: client.id,
    };

    if (client.asaasCustomerId) {
      return this.asaasService.updateCustomer(client.asaasCustomerId, payload);
    } else {
      const asaasCustomer = await this.asaasService.createCustomer(payload);
      await this.supabase
        .from('clients')
        .update({ asaasCustomerId: asaasCustomer.id })
        .eq('id', client.id);
      return asaasCustomer;
    }
  }
}
