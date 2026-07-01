import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
import { CreateClientDto, UpdateClientDto } from './dto';

// Normaliza email pra forma canonica (lowercase + trim) — pareada com a
// gravacao normalizada no banco, queries usam .eq com igualdade direta.
function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

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
    const normalizedEmail = normalizeEmail(dto.email);
    const { data: client, error } = await this.supabase
      .from('clients')
      .insert({
        id: randomUUID(),
        name: dto.name,
        phone: dto.phone,
        email: normalizedEmail,
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
          email: normalizedEmail || undefined,
          mobilePhone: dto.phone || undefined,
          cpfCnpj: dto.cpf || undefined,
          externalReference: client.id,
          notificationDisabled: true,
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

  /**
   * Busca ENXUTA de clientes (só id, name, phone) para o autocomplete do
   * agendamento. Diferente de findAll: exige termo de busca, limita resultados e
   * NÃO expõe dados sensíveis (dívidas, cpf, e-mail). É o que o BARBEIRO usa para
   * marcar horário sem ter acesso à base completa de clientes.
   */
  async searchMinimal(term: string) {
    const q = (term || '').trim();
    if (q.length < 2) return []; // sem termo → não lista a base inteira
    const { data, error } = await this.supabase
      .from('clients')
      .select('id, name, phone')
      .eq('isActive', true)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .order('name', { ascending: true })
      .limit(20);
    if (error) throw error;
    return data || [];
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
      .eq('email', normalizeEmail(email) || '')
      .limit(1)
      .maybeSingle();

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

    const updatePayload: any = { ...dto };
    if (dto.email !== undefined) {
      updatePayload.email = normalizeEmail(dto.email);
    }

    const { data: updatedClient, error } = await this.supabase
      .from('clients')
      .update(updatePayload)
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

  /**
   * "Exclusao permanente" via anonimizacao:
   * - A linha do cliente PERMANECE (preserva integridade referencial de
   *   appointments/payments/orders/subscriptions sem precisar apagar historico).
   * - Todos os dados pessoais sao limpos (nome generico, sem PII).
   * - CPF, email e googleId sao liberados (NULL) para nao bloquearem cadastros futuros.
   * - asaasCustomerId NULL para nao casar com webhook de outro cliente.
   * - isActive=false mantem o cliente fora das listas/buscas.
   *
   * Tentar DELETE direto fica bloqueado pelas FKs (appointments_clientId_fkey, etc),
   * que e o comportamento correto: nao podemos perder o historico de quem ja teve
   * agendamentos/pagamentos no salao.
   */
  async hardDelete(id: string) {
    const { data: client, error: findError } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // Cancelar as assinaturas do cliente removido. Sem isto a assinatura ficava órfã
    // (ACTIVE/SUSPENDED/PENDING) e aparecia na lista como "Cliente removido + Ativa".
    // Cancela primeiro a recorrente no Asaas (se houver) p/ parar cobrança futura —
    // depois disto o asaasCustomerId é zerado e o vínculo se perde.
    const NON_TERMINAL = ['ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED'];
    const { data: subs } = await this.supabase
      .from('client_subscriptions')
      .select('id, status, asaasSubscriptionId')
      .eq('clientId', id)
      .in('status', NON_TERMINAL);

    if (subs && subs.length > 0) {
      for (const sub of subs as any[]) {
        if (sub.asaasSubscriptionId && this.asaasService.configured) {
          try {
            await this.asaasService.cancelSubscription(sub.asaasSubscriptionId);
          } catch (e) {
            this.logger.warn(
              `hardDelete: falha ao cancelar assinatura Asaas ${sub.asaasSubscriptionId} do cliente ${id}: ${e}`,
            );
          }
        }
      }

      const canceledAt = new Date().toISOString();
      await this.supabase
        .from('client_subscriptions')
        .update({ status: 'CANCELED', canceledAt, updatedAt: canceledAt })
        .eq('clientId', id)
        .in('status', NON_TERMINAL);
    }

    const suffix = id.slice(0, 8);
    const { error } = await this.supabase
      .from('clients')
      .update({
        name: `Cliente removido (${suffix})`,
        email: null,
        password: null,
        googleId: null,
        cpf: null,
        birthDate: null,
        address: null,
        addressNumber: null,
        neighborhood: null,
        city: null,
        state: null,
        notes: null,
        asaasCustomerId: null,
        lastVisitAt: null,
        hasDebts: false,
        isActive: false,
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      })
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
      notificationDisabled: true,
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
