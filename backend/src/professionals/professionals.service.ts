import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProfessionalDto, UpdateProfessionalDto } from './dto';

@Injectable()
export class ProfessionalsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateProfessionalDto) {
    const { data: professional, error } = await this.supabase
      .from('professionals')
      .insert({
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        commission_rate: dto.commissionRate,
        working_hours: dto.workingHours || [],
      })
      .select('*')
      .single();

    if (error) throw error;

    // Connect services if provided
    if (dto.serviceIds?.length) {
      for (const serviceId of dto.serviceIds) {
        await this.supabase.from('professional_services').insert({
          professional_id: professional.id,
          service_id: serviceId,
        });
      }
    }

    return professional;
  }

  async findAll(serviceId?: string) {
    let query = this.supabase
      .from('professionals')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    const { data: professionals, error } = await query;

    if (error) throw error;
    return professionals || [];
  }

  async findActive() {
    const { data: professionals, error } = await this.supabase
      .from('professionals')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return professionals || [];
  }

  async findOne(id: string) {
    const { data: professional, error } = await this.supabase
      .from('professionals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    return professional;
  }

  async findByService(serviceId: string) {
    const { data: professionals, error } = await this.supabase
      .from('professionals')
      .select('id, name, working_hours')
      .eq('is_active', true);

    if (error) throw error;
    return professionals || [];
  }

  async isAvailable(
    professionalId: string,
    dateTime: Date,
    duration: number,
  ): Promise<boolean> {
    const { data: professional } = await this.supabase
      .from('professionals')
      .select('working_hours, is_active')
      .eq('id', professionalId)
      .single();

    if (!professional || !professional.is_active) {
      return false;
    }

    return true;
  }

  async update(id: string, dto: UpdateProfessionalDto) {
    const { data: professional, error: findError } = await this.supabase
      .from('professionals')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const { serviceIds, ...data } = dto;

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.commissionRate !== undefined) updateData.commission_rate = data.commissionRate;
    if (data.workingHours !== undefined) updateData.working_hours = data.workingHours;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: updatedProfessional, error } = await this.supabase
      .from('professionals')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updatedProfessional;
  }

  async remove(id: string) {
    const { data: professional, error: findError } = await this.supabase
      .from('professionals')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const { error } = await this.supabase
      .from('professionals')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }

  async getAppointmentsByDate(professionalId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select('id, scheduled_at, total_duration, status, clients(name)')
      .eq('professional_id', professionalId)
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString())
      .in('status', ['SCHEDULED', 'ATTENDED'])
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return appointments || [];
  }
}
