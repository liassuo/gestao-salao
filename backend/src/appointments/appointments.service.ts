import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAppointmentDto, CreateTimeBlockDto, UpdateAppointmentDto } from './dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly supabase: SupabaseService) {}

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

    // 4. Criar o agendamento
    const now = new Date().toISOString();
    const appointmentId = randomUUID();
    const { data: appointment, error: apptError } = await this.supabase
      .from('appointments')
      .insert({
        id: appointmentId,
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        scheduledAt: new Date(dto.scheduledAt).toISOString(),
        totalPrice: totalPrice,
        totalDuration: totalDuration,
        status: 'SCHEDULED',
        notes: dto.notes,
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

    return appointment;
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

  async findAll() {
    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .order('scheduledAt', { ascending: false });

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

  async findByClient(clientId: string) {
    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select(this.APPOINTMENT_SELECT)
      .eq('clientId', clientId)
      .order('scheduledAt', { ascending: false });

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

  async linkPayment(appointmentId: string, paymentId: string): Promise<void> {
    await this.supabase
      .from('appointments')
      .update({ isPaid: true })
      .eq('id', appointmentId);
  }

  async getCalendarData(date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Buscar profissionais ativos
    const { data: professionals, error: profError } = await this.supabase
      .from('professionals')
      .select('id, name, phone, workingHours')
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (profError) throw profError;

    // 2. Buscar agendamentos do dia (com dados do cliente e serviços)
    const { data: appointments, error: apptError } = await this.supabase
      .from('appointments')
      .select(`
        id, scheduledAt, status, totalPrice, totalDuration, isPaid, notes, professionalId,
        client:clients(id, name, phone),
        services:appointment_services(service:services(name))
      `)
      .gte('scheduledAt', startOfDay.toISOString())
      .lte('scheduledAt', endOfDay.toISOString());

    if (apptError) throw apptError;

    // 3. Buscar bloqueios de horário do dia
    const { data: timeBlocks, error: tbError } = await this.supabase
      .from('time_blocks')
      .select('id, startTime, endTime, reason, professionalId')
      .gte('startTime', startOfDay.toISOString())
      .lte('endTime', endOfDay.toISOString());

    if (tbError) throw tbError;

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

    const { data: block, error } = await this.supabase
      .from('time_blocks')
      .insert({
        professionalId: dto.professionalId,
        startTime: new Date(dto.startTime).toISOString(),
        endTime: new Date(dto.endTime).toISOString(),
        reason: dto.reason,
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
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingAppts } = await this.supabase
      .from('appointments')
      .select('scheduledAt, totalDuration')
      .eq('professionalId', professionalId)
      .in('status', ['SCHEDULED', 'ATTENDED'])
      .gte('scheduledAt', startOfDay.toISOString())
      .lte('scheduledAt', endOfDay.toISOString());

    // Buscar bloqueios de horário
    const { data: timeBlocks } = await this.supabase
      .from('time_blocks')
      .select('startTime, endTime')
      .eq('professionalId', professionalId)
      .gte('startTime', startOfDay.toISOString())
      .lte('endTime', endOfDay.toISOString());

    // Criar intervalos ocupados (em minutos desde meia-noite)
    const busySlots: { start: number; end: number }[] = [];

    for (const appt of existingAppts || []) {
      const apptDate = new Date(appt.scheduledAt);
      const apptStart = apptDate.getHours() * 60 + apptDate.getMinutes();
      const apptEnd = apptStart + (appt.totalDuration || 30);
      busySlots.push({ start: apptStart, end: apptEnd });
    }

    for (const block of timeBlocks || []) {
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      busySlots.push({
        start: blockStart.getHours() * 60 + blockStart.getMinutes(),
        end: blockEnd.getHours() * 60 + blockEnd.getMinutes(),
      });
    }

    // Gerar slots e verificar disponibilidade
    const slots: { time: string; available: boolean }[] = [];
    const now = new Date();
    const isToday =
      startOfDay.toDateString() === now.toDateString();
    const workStart = startHour * 60 + startMinute;
    const workEnd = endHour * 60 + endMinute;

    for (let slotMinutes = workStart; slotMinutes < workEnd; slotMinutes += 30) {
      const hour = Math.floor(slotMinutes / 60);
      const minutes = slotMinutes % 60;
      const slotTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      // Verificar se já passou (se for hoje)
      if (isToday) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (slotMinutes <= nowMinutes) {
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
}
