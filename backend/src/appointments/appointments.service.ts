import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAppointmentDto, CreateTimeBlockDto, UpdateAppointmentDto } from './dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly supabase: SupabaseService) {}

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

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

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
    const { data: appointment, error: apptError } = await this.supabase
      .from('appointments')
      .insert({
        clientId: dto.clientId,
        professionalId: dto.professionalId,
        scheduledAt: new Date(dto.scheduledAt).toISOString(),
        totalPrice: totalPrice,
        totalDuration: totalDuration,
        status: 'SCHEDULED',
        notes: dto.notes,
      })
      .select('*')
      .single();

    if (apptError) throw apptError;

    // 5. Criar vínculos com serviços
    for (const serviceId of dto.serviceIds) {
      await this.supabase.from('appointment_services').insert({
        appointmentId: appointment.id,
        serviceId: serviceId,
      });
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
      .select('*')
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
      .select('*')
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async findOne(id: string) {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .select('*')
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
      .select('*')
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
      .select('*')
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
      .select('*')
      .eq('clientId', clientId)
      .order('scheduledAt', { ascending: false });

    if (error) throw error;
    return appointments || [];
  }

  async findUnpaid() {
    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select('*')
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
      .select('*')
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
      .select('*')
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

    const { data: professionals, error } = await this.supabase
      .from('professionals')
      .select('id, name, phone, workingHours')
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return professionals || [];
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
  ): Promise<{ time: string; available: boolean }[]> {
    const { data: professional } = await this.supabase
      .from('professionals')
      .select('workingHours')
      .eq('id', professionalId)
      .single();

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const slots: { time: string; available: boolean }[] = [];
    const startHour = 8;
    const endHour = 18;

    for (let hour = startHour; hour < endHour; hour++) {
      for (const minutes of [0, 30]) {
        const slotTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        slots.push({ time: slotTime, available: true });
      }
    }

    return slots;
  }
}
