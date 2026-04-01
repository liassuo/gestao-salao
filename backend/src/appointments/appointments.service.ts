import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAppointmentDto, CreateTimeBlockDto, UpdateAppointmentDto } from './dto';
import { AsaasService } from '../asaas/asaas.service';
import {
  AsaasBillingType,
  asaasBillingToLocalPaymentMethod,
  parseAsaasBillingType,
} from '../asaas/asaas.types';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly asaasService: AsaasService,
  ) {}

  /** Select padrão com joins para client, professional e services */
  private readonly APPOINTMENT_SELECT = `
    *,
    client:clients(id, name, phone, email),
    professional:professionals(id, name),
    services:appointment_services(id, service:services(id, name, price, duration))
  `;

  async create(dto: CreateAppointmentDto) {
    // 1. Verificar se o profissional existe e está ativo
    const { data: professional, error: profError } = await this.supabase
      .from('professionals')
      .select('id, isActive')
      .eq('id', dto.professionalId)
      .single();

    if (profError || !professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    if (!professional.isActive) {
      throw new BadRequestException('Profissional não está ativo');
    }

    // 2. Buscar os serviços e calcular duração total
    const { data: services, error: svcError } = await this.supabase
      .from('services')
      .select('id, price, duration')
      .in('id', dto.serviceIds)
      .eq('isActive', true);

    if (svcError || !services || services.length !== dto.serviceIds.length) {
      throw new BadRequestException('Um ou mais serviços não encontrados ou inativos');
    }

    // 2.1 Buscar promoções ativas para aplicar desconto
    const now2 = new Date().toISOString();
    const { data: activePromos } = await this.supabase
      .from('promotions')
      .select('discountPercent, promotion_services(serviceId)')
      .eq('isActive', true)
      .eq('status', 'ACTIVE')
      .lte('startDate', now2)
      .gte('endDate', now2);

    const getDiscount = (serviceId: string): number | null => {
      if (!activePromos) return null;
      for (const promo of activePromos) {
        const match = (promo.promotion_services as any[])?.find(
          (ps) => ps.serviceId === serviceId,
        );
        if (match) return promo.discountPercent;
      }
      return null;
    };

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => {
      const discount = getDiscount(s.id);
      if (discount !== null) {
        return sum + Math.round(s.price * (100 - discount) / 100);
      }
      return sum + s.price;
    }, 0);

    // 3. Verificar se o cliente existe
    const { data: client, error: clientError } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', dto.clientId)
      .single();

    if (clientError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // 3.1 Bloquear agendamento se cliente possui dívidas pendentes
    if (dto.source === 'CLIENT') {
      const { data: clientDebts } = await this.supabase
        .from('debts')
        .select('remainingBalance')
        .eq('clientId', dto.clientId)
        .eq('isSettled', false);

      if (clientDebts && clientDebts.length > 0) {
        const totalDebt = clientDebts.reduce((sum, d) => sum + d.remainingBalance, 0);
        const reais = Math.floor(totalDebt / 100);
        const centavos = totalDebt % 100;
        const formatted = `${reais},${String(centavos).padStart(2, '0')}`;
        throw new BadRequestException(
          `Você possui uma dívida pendente de R$ ${formatted}. Quite sua dívida antes de fazer um novo agendamento.`,
        );
      }
    }

    // 4. Verificar conflitos com bloqueios de horário e agendamentos existentes
    const scheduledDate = String(dto.scheduledAt).substring(0, 10); // YYYY-MM-DD
    const startOfDay = `${scheduledDate}T00:00:00`;
    const endOfDay = `${scheduledDate}T23:59:59`;

    // Extrair horas e minutos de string datetime sem depender de timezone do JS
    const parseMin = (dateStr: string): number => {
      const timePart = String(dateStr).substring(11, 16);
      const [h, m] = timePart.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const apptStartMinutes = parseMin(String(dto.scheduledAt));
    const apptEndMinutes = apptStartMinutes + totalDuration;

    // 4a. Verificar bloqueios de horário
    const { data: timeBlocks } = await this.supabase
      .from('time_blocks')
      .select('startTime, endTime')
      .eq('professionalId', dto.professionalId)
      .gte('startTime', startOfDay)
      .lte('endTime', endOfDay);

    for (const block of timeBlocks || []) {
      const blockStartMin = parseMin(block.startTime);
      const blockEndMin = parseMin(block.endTime);

      if (apptStartMinutes < blockEndMin && apptEndMinutes > blockStartMin) {
        throw new ConflictException(
          'O horário selecionado conflita com um bloqueio de horário do profissional',
        );
      }
    }

    // 4b. Verificar agendamentos existentes
    const { data: existingAppts } = await this.supabase
      .from('appointments')
      .select('scheduledAt, totalDuration')
      .eq('professionalId', dto.professionalId)
      .in('status', ['SCHEDULED', 'ATTENDED', 'PENDING_PAYMENT'])
      .gte('scheduledAt', startOfDay)
      .lte('scheduledAt', endOfDay);

    for (const existing of existingAppts || []) {
      const existStartMin = parseMin(existing.scheduledAt);
      const existEndMin = existStartMin + (existing.totalDuration || 30);

      if (apptStartMinutes < existEndMin && apptEndMinutes > existStartMin) {
        throw new ConflictException(
          'O horário selecionado conflita com outro agendamento existente',
        );
      }
    }

    // 5. Verificar se já existe PIX pendente ativo (< 10 min) para este cliente
    const requiresOnlinePayment =
      dto.source === 'CLIENT' &&
      (dto.billingType === 'PIX' || dto.billingType === 'CREDIT_CARD');

    if (requiresOnlinePayment && dto.billingType === 'PIX') {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: pendingAppts } = await this.supabase
        .from('appointments')
        .select('id')
        .eq('clientId', dto.clientId)
        .eq('status', 'PENDING_PAYMENT')
        .limit(1);

      if (pendingAppts?.length) {
        const { data: activePix } = await this.supabase
          .from('payments')
          .select('id, asaasPaymentId, amount, createdAt')
          .eq('appointmentId', pendingAppts[0].id)
          .eq('method', 'PIX')
          .is('paidAt', null)
          .gte('createdAt', tenMinAgo)
          .limit(1);

        if (activePix?.length) {
          // Se o valor mudou (serviços diferentes), cancelar o antigo e deixar criar novo
          if (activePix[0].amount !== totalPrice) {
            this.logger.log(
              `Valor mudou (${activePix[0].amount} -> ${totalPrice}). Cancelando agendamento pendente ${pendingAppts[0].id}`,
            );
            // Cancelar cobrança Asaas antiga
            if (activePix[0].asaasPaymentId) {
              try { await this.asaasService.cancelCharge(activePix[0].asaasPaymentId); } catch {}
            }
            // Cancelar agendamento antigo
            await this.supabase
              .from('appointments')
              .update({ status: 'CANCELED', canceledAt: new Date().toISOString() })
              .eq('id', pendingAppts[0].id);
          } else {
            // Mesmo valor: retornar o agendamento existente com QR code
            const { data: existingAppt } = await this.supabase
              .from('appointments')
              .select(this.APPOINTMENT_SELECT)
              .eq('id', pendingAppts[0].id)
              .single();

            if (existingAppt) {
              const qrData = await this.getPendingPixQrCode(existingAppt.id, dto.clientId);
              return {
                ...existingAppt,
                existingPendingPayment: true,
                paymentCreatedAt: activePix[0].createdAt,
                payment: qrData.pixData
                  ? { pixData: qrData.pixData }
                  : null,
              };
            }
          }
        }
      }
    }

    // 6. Criar o agendamento
    // Pagamentos online via app (PIX/cartão) ficam PENDING_PAYMENT até confirmação do Asaas
    const initialStatus = requiresOnlinePayment ? 'PENDING_PAYMENT' : 'SCHEDULED';

    const now = new Date().toISOString();
    const appointmentId = randomUUID();
    const { data: appointment, error: apptError } = await this.supabase
      .from('appointments')
      .insert({
        id: appointmentId,
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        scheduledAt: String(dto.scheduledAt),
        totalPrice: totalPrice,
        totalDuration: totalDuration,
        status: initialStatus,
        notes: dto.notes,
        source: dto.source || 'ADMIN',
        usedSubscriptionCut: !!dto.useSubscriptionCut,
        createdAt: now,
        updatedAt: now,
      })
      .select(this.APPOINTMENT_SELECT)
      .single();

    if (apptError) {
      throw new BadRequestException(apptError.message || 'Erro ao criar agendamento');
    }

    // 5. Criar vínculos com serviços
    for (const serviceId of dto.serviceIds) {
      const { error: linkError } = await this.supabase.from('appointment_services').insert({
        id: randomUUID(),
        appointmentId: appointment.id,
        serviceId: serviceId,
        createdAt: now,
      });
      if (linkError) {
        throw new BadRequestException('Erro ao vincular serviço ao agendamento');
      }
    }

    // 6. Criar cobrança no Asaas (se configurado, valor > 0 e não for pago só com crédito do plano)
    let pixData = null;
    let asaasCharge = null;
    const billingType = parseAsaasBillingType(dto.billingType);
    const skipAsaasForSubscriptionCut = !!dto.useSubscriptionCut;

    if (this.asaasService.configured && totalPrice > 0 && !skipAsaasForSubscriptionCut && dto.billingType !== 'CASH') {
      try {
        // Buscar/Criar cliente no Asaas (valida se o ID existente é do ambiente correto)
        const { data: clientData } = await this.supabase
          .from('clients')
          .select('id, name, email, phone, cpf, asaasCustomerId')
          .eq('id', dto.clientId)
          .single();

        let asaasCustomerId = clientData?.asaasCustomerId;

        // Validar se o customer existente é acessível no ambiente atual
        if (asaasCustomerId) {
          try {
            await this.asaasService.findCustomerByExternalReference(dto.clientId);
          } catch {
            this.logger.warn(`asaasCustomerId ${asaasCustomerId} inválido (provável troca de ambiente). Recriando...`);
            asaasCustomerId = null;
            await this.supabase.from('clients').update({ asaasCustomerId: null }).eq('id', dto.clientId);
          }
        }

        if (!asaasCustomerId && clientData) {
          if (!clientData.cpf) {
            throw new BadRequestException(
              'CPF é obrigatório para gerar cobranças. Atualize seu perfil com um CPF válido.',
            );
          }
          const newCustomer = await this.asaasService.createCustomer({
            name: clientData.name,
            email: clientData.email || undefined,
            cpfCnpj: clientData.cpf,
            mobilePhone: clientData.phone || undefined,
            externalReference: clientData.id,
          });
          asaasCustomerId = newCustomer.id;
          await this.supabase
            .from('clients')
            .update({ asaasCustomerId })
            .eq('id', clientData.id);
        }

        if (asaasCustomerId) {
          asaasCharge = await this.asaasService.createCharge({
            customer: asaasCustomerId,
            billingType,
            value: this.asaasService.centavosToReais(totalPrice),
            dueDate: String(dto.scheduledAt).substring(0, 10),
            description: `Agendamento: ${appointment.id}`,
            externalReference: appointment.id,
          });

          const localMethod = asaasBillingToLocalPaymentMethod(billingType);
          await this.supabase.from('payments').insert({
            id: randomUUID(),
            clientId: dto.clientId,
            appointmentId: appointment.id,
            amount: totalPrice,
            method: localMethod,
            asaasPaymentId: asaasCharge.id,
            asaasStatus: asaasCharge.status,
            invoiceUrl: asaasCharge.invoiceUrl || null,
            bankSlipUrl: asaasCharge.bankSlipUrl || null,
            createdAt: now,
            updatedAt: now,
          });

          if (billingType === AsaasBillingType.PIX) {
            pixData = await this.asaasService.getPixQrCode(asaasCharge.id);
            // Salvar QR code no banco para reutilizar sem chamar Asaas novamente
            if (pixData) {
              await this.supabase.from('payments').update({
                pixQrCodeBase64: pixData.encodedImage,
                pixCopyPaste: pixData.payload,
              }).eq('asaasPaymentId', asaasCharge.id);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Erro ao criar cobrança Asaas para agendamento ${appointment.id}: ${error}`);
      }
    }

    return {
      ...appointment,
      payment: asaasCharge
        ? {
            id: asaasCharge.id,
            billingType,
            invoiceUrl: asaasCharge.invoiceUrl,
            pixData,
          }
        : null,
    };
  }

  async cancel(id: string) {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status === 'ATTENDED') {
      throw new BadRequestException('Não é possível cancelar um agendamento já atendido');
    }

    if (appointment.status === 'CANCELED') {
      throw new BadRequestException('Agendamento já está cancelado');
    }

    // Cancelar cobrança Asaas pendente (se existir)
    if (appointment.status === 'PENDING_PAYMENT' && this.asaasService.configured) {
      const { data: pendingPayment } = await this.supabase
        .from('payments')
        .select('id, asaasPaymentId')
        .eq('appointmentId', id)
        .is('paidAt', null)
        .in('method', ['PIX', 'CARD'])
        .single();

      if (pendingPayment?.asaasPaymentId) {
        try {
          await this.asaasService.cancelCharge(pendingPayment.asaasPaymentId);
          this.logger.log(`Cobrança Asaas ${pendingPayment.asaasPaymentId} cancelada (agendamento ${id} cancelado)`);
        } catch (e) {
          this.logger.warn(`Falha ao cancelar cobrança Asaas ${pendingPayment.asaasPaymentId}: ${e}`);
        }
      }
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('appointments')
      .update({ status: 'CANCELED', canceledAt: new Date().toISOString() })
      .eq('id', id)
      .select(this.APPOINTMENT_SELECT)
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async markAsAttended(id: string) {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status === 'CANCELED') {
      throw new BadRequestException('Não é possível marcar como atendido um agendamento cancelado');
    }

    if (appointment.status === 'ATTENDED') {
      throw new BadRequestException('Agendamento já foi marcado como atendido');
    }

    // Converter pagamento online não pago para pagamento no local
    const { data: pendingPayment } = await this.supabase
      .from('payments')
      .select('id, asaasPaymentId, asaasStatus, method')
      .eq('appointmentId', id)
      .is('paidAt', null)
      .in('method', ['PIX', 'CARD'])
      .single();

    if (pendingPayment) {
      const now = new Date().toISOString();
      await this.supabase
        .from('payments')
        .update({
          method: 'CASH',
          asaasStatus: null,
          notes: `Convertido para pagamento no local (original: ${pendingPayment.method})`,
          updatedAt: now,
        })
        .eq('id', pendingPayment.id);

      // Cancelar cobrança no Asaas (se existir)
      if (pendingPayment.asaasPaymentId && this.asaasService.configured) {
        try {
          await this.asaasService.cancelCharge(pendingPayment.asaasPaymentId);
          this.logger.log(`Cobrança Asaas ${pendingPayment.asaasPaymentId} cancelada (agendamento ${id} atendido sem pagamento online)`);
        } catch (e) {
          this.logger.warn(`Falha ao cancelar cobrança Asaas ${pendingPayment.asaasPaymentId}: ${e}`);
        }
      }
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('appointments')
      .update({ status: 'ATTENDED', attendedAt: new Date().toISOString() })
      .eq('id', id)
      .select(this.APPOINTMENT_SELECT)
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async findOne(id: string) {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .eq('id', id)
      .single();

    if (error || !appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return appointment;
  }

  async findAll(filters?: {
    professionalId?: string;
    clientId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    let query = this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT);

    if (filters?.professionalId) {
      query = query.eq('professionalId', filters.professionalId);
    }

    if (filters?.clientId) {
      query = query.eq('clientId', filters.clientId);
    }

    if (filters?.startDate) {
      query = query.gte('scheduledAt', `${filters.startDate}T00:00:00`);
    }

    if (filters?.endDate) {
      query = query.lte('scheduledAt', `${filters.endDate}T23:59:59`);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data: appointments, error } = await query.order('scheduledAt', { ascending: false });

    if (error) throw error;
    return appointments || [];
  }

  async findByProfessionalAndDate(
    professionalId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .eq('professionalId', professionalId)
      .gte('scheduledAt', startDate.toISOString())
      .lte('scheduledAt', endDate.toISOString())
      .order('scheduledAt', { ascending: true });

    if (error) throw error;
    return appointments || [];
  }

  async findByClient(clientId: string, status?: string) {
    let query = this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .eq('clientId', clientId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: appointments, error } = await query.order('scheduledAt', { ascending: false });

    if (error) throw error;
    return appointments || [];
  }

  async findUnpaid() {
    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .eq('isPaid', false)
      .eq('status', 'ATTENDED')
      .order('scheduledAt', { ascending: false });

    if (error) throw error;
    return appointments || [];
  }

  async markAsNoShow(id: string) {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status !== 'SCHEDULED') {
      throw new BadRequestException('Só é possível marcar como no-show agendamentos com status SCHEDULED');
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('appointments')
      .update({ status: 'NO_SHOW' })
      .eq('id', id)
      .select(this.APPOINTMENT_SELECT)
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status !== 'SCHEDULED') {
      throw new BadRequestException('Só é possível editar agendamentos com status SCHEDULED');
    }

    const updateData: any = {};
    if (dto.scheduledAt) updateData.scheduledAt = new Date(dto.scheduledAt).toISOString();
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const { data: updated, error: updateError } = await this.supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select(this.APPOINTMENT_SELECT)
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async rateAppointment(id: string, clientId: string, rating: number, comment?: string) {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select('id, status, clientId, rating')
      .eq('id', id)
      .single();

    if (error || !appointment) {
      throw new NotFoundException('Agendamento nao encontrado');
    }

    if (appointment.clientId !== clientId) {
      throw new BadRequestException('Voce so pode avaliar seus proprios agendamentos');
    }

    if (appointment.status !== 'ATTENDED') {
      throw new BadRequestException('So e possivel avaliar agendamentos ja atendidos');
    }

    if (appointment.rating) {
      throw new BadRequestException('Este agendamento ja foi avaliado');
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('appointments')
      .update({ rating, ratingComment: comment || null })
      .eq('id', id)
      .select(this.APPOINTMENT_SELECT)
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async getPendingPixQrCode(appointmentId: string, clientId: string) {
    const { data: appointment } = await this.supabase
      .from('appointments')
      .select('id, clientId, totalPrice, status')
      .eq('id', appointmentId)
      .eq('clientId', clientId)
      .single();

    if (!appointment) throw new NotFoundException('Agendamento não encontrado');
    if (appointment.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Este agendamento não possui pagamento PIX pendente');
    }

    if (!this.asaasService.configured) {
      throw new BadRequestException('Integração PIX não configurada');
    }

    // Buscar pagamento PIX pendente (só colunas que sempre existem)
    const { data: payments } = await this.supabase
      .from('payments')
      .select('id, asaasPaymentId, createdAt')
      .eq('appointmentId', appointmentId)
      .is('paidAt', null)
      .eq('method', 'PIX');

    const payment = payments?.[0];
    const paymentCreatedAt = payment?.createdAt || null;

    // Se não existe pagamento, criar cobrança do zero
    if (!payment?.asaasPaymentId) {
      this.logger.warn(`Nenhum pagamento PIX encontrado para agendamento ${appointmentId}, criando cobrança`);
      return await this.recreatePixCharge(appointment, null);
    }

    // Tentar buscar QR salvo no banco (colunas podem não existir ainda)
    try {
      const { data: cached } = await this.supabase
        .from('payments')
        .select('pixQrCodeBase64, pixCopyPaste')
        .eq('id', payment.id)
        .single();

      if (cached?.pixQrCodeBase64 && cached?.pixCopyPaste) {
        return {
          pixData: {
            encodedImage: cached.pixQrCodeBase64,
            payload: cached.pixCopyPaste,
          },
          totalPrice: appointment.totalPrice,
          paymentCreatedAt,
        };
      }
    } catch {
      // Colunas provavelmente não existem — seguir para buscar no Asaas
    }

    // Buscar QR Code no Asaas para a cobrança EXISTENTE
    try {
      const pixData = await this.asaasService.getPixQrCode(payment.asaasPaymentId);

      // Tentar salvar cache (ignora se colunas não existem)
      if (pixData) {
        try {
          await this.supabase.from('payments').update({
            pixQrCodeBase64: pixData.encodedImage,
            pixCopyPaste: pixData.payload,
          }).eq('id', payment.id);
        } catch {
          // Colunas podem não existir — ignorar
        }
      }

      return { pixData, totalPrice: appointment.totalPrice, paymentCreatedAt };
    } catch (e) {
      // Cobrança cancelada/expirada no Asaas — recriar
      this.logger.warn(`Falha ao buscar QR Code da cobrança ${payment.asaasPaymentId}, recriando: ${e}`);
      return await this.recreatePixCharge(appointment, payment);
    }
  }

  private async recreatePixCharge(
    appointment: { id: string; clientId: string; totalPrice: number },
    oldPayment: { id: string; asaasPaymentId: string } | null,
  ) {
    // Buscar cliente Asaas
    const { data: clientData } = await this.supabase
      .from('clients')
      .select('id, name, email, phone, cpf, asaasCustomerId')
      .eq('id', appointment.clientId)
      .single();

    let asaasCustomerId = clientData?.asaasCustomerId;

    // Criar customer no Asaas se não existir
    if (!asaasCustomerId && clientData) {
      if (!clientData.cpf) {
        throw new BadRequestException(
          'CPF é obrigatório para gerar cobranças. Atualize seu perfil com um CPF válido.',
        );
      }
      const newCustomer = await this.asaasService.createCustomer({
        name: clientData.name,
        email: clientData.email || undefined,
        cpfCnpj: clientData.cpf,
        mobilePhone: clientData.phone || undefined,
        externalReference: clientData.id,
      });
      asaasCustomerId = newCustomer.id;
      await this.supabase.from('clients').update({ asaasCustomerId }).eq('id', clientData.id);
    }

    if (!asaasCustomerId) {
      throw new BadRequestException('Cliente não possui cadastro no Asaas');
    }

    // Cancelar cobrança antiga (ignora erro se já cancelada)
    if (oldPayment?.asaasPaymentId) {
      try { await this.asaasService.cancelCharge(oldPayment.asaasPaymentId); } catch {}
    }

    // Criar nova cobrança
    const today = new Date().toISOString().substring(0, 10);
    const newCharge = await this.asaasService.createCharge({
      customer: asaasCustomerId,
      billingType: 'PIX' as any,
      value: this.asaasService.centavosToReais(appointment.totalPrice),
      dueDate: today,
      description: `Agendamento: ${appointment.id}`,
      externalReference: appointment.id,
    });

    const now = new Date().toISOString();

    if (oldPayment) {
      // Atualizar pagamento existente
      await this.supabase.from('payments').update({
        asaasPaymentId: newCharge.id,
        asaasStatus: newCharge.status,
        invoiceUrl: newCharge.invoiceUrl || null,
        updatedAt: now,
      }).eq('id', oldPayment.id);
    } else {
      // Criar novo registro de pagamento
      await this.supabase.from('payments').insert({
        id: randomUUID(),
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        amount: appointment.totalPrice,
        method: 'PIX',
        asaasPaymentId: newCharge.id,
        asaasStatus: newCharge.status,
        invoiceUrl: newCharge.invoiceUrl || null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Buscar QR Code da nova cobrança e salvar no banco
    const pixData = await this.asaasService.getPixQrCode(newCharge.id);
    if (pixData) {
      await this.supabase.from('payments').update({
        pixQrCodeBase64: pixData.encodedImage,
        pixCopyPaste: pixData.payload,
      }).eq('asaasPaymentId', newCharge.id);
    }
    return { pixData, totalPrice: appointment.totalPrice };
  }

  async linkPayment(appointmentId: string, paymentId: string): Promise<void> {
    await this.supabase
      .from('appointments')
      .update({ isPaid: true })
      .eq('id', appointmentId);
  }

  async getCalendarData(date: string) {
    if (!date || isNaN(new Date(date).getTime())) {
      throw new BadRequestException('Data inválida');
    }

    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    this.logger.log(`Calendar query for ${date}: ${startOfDay} - ${endOfDay}`);

    // 1. Buscar profissionais ativos
    const { data: professionals, error: profError } = await this.supabase
      .from('professionals')
      .select('id, name, workingHours, avatarUrl')
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (profError) {
      this.logger.error(`Calendar professionals query error: ${JSON.stringify(profError)}`);
      throw profError;
    }

    // 2. Buscar agendamentos do dia (com dados do cliente e serviços)
    const { data: appointments, error: apptError } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .gte('scheduledAt', startOfDay)
      .lte('scheduledAt', endOfDay);

    if (apptError) {
      this.logger.error(`Calendar appointments query error: ${JSON.stringify(apptError)}`);
      throw apptError;
    }

    // 3. Buscar bloqueios de horário do dia
    const { data: timeBlocks, error: tbError } = await this.supabase
      .from('time_blocks')
      .select('id, startTime, endTime, reason, professionalId')
      .gte('startTime', startOfDay)
      .lte('endTime', endOfDay);

    if (tbError) {
      this.logger.error(`Calendar time_blocks query error: ${JSON.stringify(tbError)}`);
      throw tbError;
    }

    // 4. Agrupar por profissional
    return (professionals || []).map(prof => ({
      ...prof,
      appointments: (appointments || []).filter(a => a.professionalId === prof.id),
      timeBlocks: (timeBlocks || []).filter(tb => tb.professionalId === prof.id),
    }));
  }

  async createTimeBlock(dto: CreateTimeBlockDto) {
    const { data: professional, error: profError } = await this.supabase
      .from('professionals')
      .select('id')
      .eq('id', dto.professionalId)
      .single();

    if (profError || !professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const now = new Date().toISOString();
    const { data: block, error } = await this.supabase
      .from('time_blocks')
      .insert({
        id: randomUUID(),
        professionalId: dto.professionalId,
        startTime: String(dto.startTime),
        endTime: String(dto.endTime),
        reason: dto.reason,
        createdAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;
    return block;
  }

  async deleteTimeBlock(id: string) {
    const { data: block, error: findError } = await this.supabase
      .from('time_blocks')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !block) {
      throw new NotFoundException('Bloqueio não encontrado');
    }

    const { error } = await this.supabase
      .from('time_blocks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return block;
  }

  async getAvailableSlots(
    professionalId: string,
    date: string,
    serviceDuration?: number,
  ): Promise<{ time: string; available: boolean }[]> {
    const { data: professional } = await this.supabase
      .from('professionals')
      .select('workingHours')
      .eq('id', professionalId)
      .single();

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    // Determinar horário de trabalho do profissional
    let startHour = 8;
    let endHour = 18;
    let startMinute = 0;
    let endMinute = 0;
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay(); // 0=Dom, 1=Seg...

    if (professional.workingHours && Array.isArray(professional.workingHours)) {
      // Formato: [{dayOfWeek: 1, startTime: '09:00', endTime: '18:00'}]
      const daySchedule = (professional.workingHours as any[]).find(
        (wh: any) => wh.dayOfWeek === dayOfWeek,
      );

      if (!daySchedule) {
        return []; // Profissional não trabalha neste dia
      }

      if (daySchedule.startTime) {
        const [h, m] = daySchedule.startTime.split(':').map(Number);
        startHour = h;
        startMinute = m || 0;
      }
      if (daySchedule.endTime) {
        const [h, m] = daySchedule.endTime.split(':').map(Number);
        endHour = h;
        endMinute = m || 0;
      }
    }

    // Buscar agendamentos existentes do profissional neste dia
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data: existingAppts } = await this.supabase
      .from('appointments')
      .select('scheduledAt, totalDuration')
      .eq('professionalId', professionalId)
      .in('status', ['SCHEDULED', 'ATTENDED', 'PENDING_PAYMENT'])
      .gte('scheduledAt', startOfDay)
      .lte('scheduledAt', endOfDay);

    // Buscar bloqueios de horário
    const { data: timeBlocks } = await this.supabase
      .from('time_blocks')
      .select('startTime, endTime')
      .eq('professionalId', professionalId)
      .gte('startTime', startOfDay)
      .lte('endTime', endOfDay);

    // Extrair horas e minutos de uma string datetime (local, sem depender de timezone do JS)
    const parseMinutes = (dateStr: string): number => {
      // Formato esperado: "YYYY-MM-DDTHH:mm:ss" ou "YYYY-MM-DDTHH:mm:ss.sssZ"
      const timePart = String(dateStr).substring(11, 16); // "HH:mm"
      const [h, m] = timePart.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    // Criar intervalos ocupados (em minutos desde meia-noite)
    const busySlots: { start: number; end: number }[] = [];

    for (const appt of existingAppts || []) {
      const apptStart = parseMinutes(appt.scheduledAt);
      const apptEnd = apptStart + (appt.totalDuration || 30);
      busySlots.push({ start: apptStart, end: apptEnd });
    }

    for (const block of timeBlocks || []) {
      busySlots.push({
        start: parseMinutes(block.startTime),
        end: parseMinutes(block.endTime),
      });
    }

    // Gerar slots e verificar disponibilidade
    const slots: { time: string; available: boolean }[] = [];
    const now = new Date();

    // Usar fuso horário do Brasil (America/Sao_Paulo) para comparar data/hora atual
    const brazilDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now); // formato "YYYY-MM-DD"

    const brazilTimeStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now); // formato "HH:mm"

    const isToday = date === brazilDateStr;
    const [nowH, nowM] = brazilTimeStr.split(':').map(Number);
    const nowMinutesBrazil = nowH * 60 + nowM;

    const workStart = startHour * 60 + startMinute;
    const workEnd = endHour * 60 + endMinute;

    for (let slotMinutes = workStart; slotMinutes < workEnd; slotMinutes += 30) {
      const hour = Math.floor(slotMinutes / 60);
      const minutes = slotMinutes % 60;
      const slotTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      // Verificar se já passou (se for hoje) — comparação em horário de Brasília
      if (isToday) {
        if (slotMinutes <= nowMinutesBrazil) {
          slots.push({ time: slotTime, available: false });
          continue;
        }
      }

      // Verificar conflito com agendamentos e bloqueios
      const duration = serviceDuration || 30;
      const slotEnd = slotMinutes + duration;

      // Verificar se o serviço caberia antes do fim do expediente
      if (slotEnd > workEnd) {
        slots.push({ time: slotTime, available: false });
        continue;
      }

      // Verificar conflito: o slot inteiro (start até start+duration) não pode sobrepor nenhum busy
      const hasConflict = busySlots.some(
        (busy) => slotMinutes < busy.end && slotEnd > busy.start,
      );

      slots.push({ time: slotTime, available: !hasConflict });
    }

    return slots;
  }

  /**
   * Cron: cancelar agendamentos PENDING_PAYMENT com mais de 10 minutos.
   * Roda a cada 2 minutos para garantir que horários sejam liberados
   * mesmo se o cliente fechar o navegador.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expirePendingPayments() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: stale } = await this.supabase
      .from('appointments')
      .select('id')
      .eq('status', 'PENDING_PAYMENT')
      .lt('createdAt', tenMinutesAgo);

    if (!stale?.length) return;

    const now = new Date().toISOString();
    for (const appt of stale) {
      await this.supabase
        .from('appointments')
        .update({ status: 'CANCELED', updatedAt: now })
        .eq('id', appt.id)
        .eq('status', 'PENDING_PAYMENT');

      // Cancelar cobrança no Asaas se existir
      if (this.asaasService.configured) {
        const { data: payment } = await this.supabase
          .from('payments')
          .select('asaasPaymentId')
          .eq('appointmentId', appt.id)
          .is('paidAt', null)
          .single();

        if (payment?.asaasPaymentId) {
          try { await this.asaasService.cancelCharge(payment.asaasPaymentId); } catch {}
        }
      }

      this.logger.log(`Agendamento ${appt.id} cancelado automaticamente (PENDING_PAYMENT expirado)`);
    }
  }
}
