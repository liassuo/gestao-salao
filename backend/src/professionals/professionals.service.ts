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
        avatarUrl: dto.avatarUrl || null,
        commissionRate: dto.commissionRate,
        workingHours: dto.workingHours || [],
      })
      .select('*')
      .single();

    if (error) throw error;

    // Connect services if provided
    if (dto.serviceIds?.length) {
      for (const serviceId of dto.serviceIds) {
        await this.supabase.from('professional_services').insert({
          professionalId: professional.id,
          serviceId: serviceId,
        });
      }
    }

    return professional;
  }

  async findAll(serviceId?: string) {
    const { data: professionals, error } = await this.supabase
      .from('professionals')
      .select('*, appointment_count:appointments(count), professional_services(serviceId, service:services(id, name))')
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return (professionals || []).map(({ appointment_count, professional_services, ...prof }: any) => ({
      ...prof,
      services: (professional_services || []).map((ps: any) => ({
        id: ps.service?.id || ps.serviceId,
        name: ps.service?.name,
      })),
      _count: {
        appointments: appointment_count?.[0]?.count || 0,
      },
    }));
  }

  async findActive() {
    const { data: professionals, error } = await this.supabase
      .from('professionals')
      .select('id, name, avatarUrl, professional_services(serviceId)')
      .eq('isActive', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return (professionals || []).map(({ professional_services, ...prof }: any) => ({
      ...prof,
      serviceIds: (professional_services || []).map((ps: any) => ps.serviceId),
    }));
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
      .select('id, name, workingHours')
      .eq('isActive', true);

    if (error) throw error;
    return professionals || [];
  }

  async findAvailableForBooking(serviceIds: string[], date: string) {
    // 1. Buscar profissionais vinculados aos serviços via _ProfessionalToService
    const { data: links, error: linkError } = await this.supabase
      .from('_ProfessionalToService')
      .select('A, B')
      .in('B', serviceIds);

    if (linkError) throw linkError;

    // Filtrar profissionais que atendem TODOS os serviços selecionados
    const profCountMap: Record<string, number> = {};
    for (const link of links || []) {
      profCountMap[link.A] = (profCountMap[link.A] || 0) + 1;
    }
    const eligibleProfIds = Object.entries(profCountMap)
      .filter(([, count]) => count >= serviceIds.length)
      .map(([id]) => id);

    if (eligibleProfIds.length === 0) return [];

    // 2. Buscar dados dos profissionais ativos
    const { data: professionals, error: profError } = await this.supabase
      .from('professionals')
      .select('id, name, phone, email, avatarUrl, workingHours')
      .eq('isActive', true)
      .in('id', eligibleProfIds);

    if (profError) throw profError;
    if (!professionals || professionals.length === 0) return [];

    // 3. Filtrar por dia de trabalho (workingHours)
    const targetDate = new Date(date + 'T12:00:00Z');
    const dayOfWeek = targetDate.getUTCDay(); // 0=Dom, 1=Seg, ..., 6=Sab

    const workingProfessionals = professionals.filter((prof: any) => {
      if (!prof.workingHours || prof.workingHours.length === 0) return false;
      return prof.workingHours.some((wh: any) => wh.dayOfWeek === dayOfWeek);
    });

    if (workingProfessionals.length === 0) return [];

    // 4. Excluir profissionais com bloqueio de dia inteiro na data
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const { data: timeBlocks } = await this.supabase
      .from('time_blocks')
      .select('professionalId, startTime, endTime')
      .in('professionalId', workingProfessionals.map((p: any) => p.id))
      .lte('startTime', endOfDay.toISOString())
      .gte('endTime', startOfDay.toISOString());

    // Profissionais com bloqueio que cobre o dia inteiro (8h+ de bloqueio)
    const blockedProfIds = new Set<string>();
    for (const block of timeBlocks || []) {
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      const blockHours = (blockEnd.getTime() - blockStart.getTime()) / (1000 * 60 * 60);
      if (blockHours >= 8) {
        blockedProfIds.add(block.professionalId);
      }
    }

    return workingProfessionals
      .filter((p: any) => !blockedProfIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        avatarUrl: p.avatarUrl,
      }));
  }

  async isAvailable(
    professionalId: string,
    dateTime: Date,
    duration: number,
  ): Promise<boolean> {
    const { data: professional } = await this.supabase
      .from('professionals')
      .select('workingHours, isActive')
      .eq('id', professionalId)
      .single();

    if (!professional || !professional.isActive) {
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
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.commissionRate !== undefined) updateData.commissionRate = data.commissionRate;
    if (data.workingHours !== undefined) updateData.workingHours = data.workingHours;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const { data: updatedProfessional, error } = await this.supabase
      .from('professionals')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    if (serviceIds) {
      // Remove existing service links
      await this.supabase
        .from('professional_services')
        .delete()
        .eq('professionalId', id);

      // Insert new ones
      if (serviceIds.length > 0) {
        for (const svcId of serviceIds) {
          await this.supabase.from('professional_services').insert({
            professionalId: id,
            serviceId: svcId,
          });
        }
      }
    }

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
      .update({ isActive: false })
      .eq('id', id);

    if (error) throw error;
  }

  async uploadAvatar(file: Express.Multer.File) {
    const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    const { data, error } = await this.supabase.client.storage
      .from('professional-avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = this.supabase.client.storage
      .from('professional-avatars')
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl };
  }

  async getAppointmentsByDate(professionalId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select('id, scheduledAt, totalDuration, status, clients(name)')
      .eq('professionalId', professionalId)
      .gte('scheduledAt', startOfDay.toISOString())
      .lte('scheduledAt', endOfDay.toISOString())
      .in('status', ['SCHEDULED', 'ATTENDED'])
      .order('scheduledAt', { ascending: true });

    if (error) throw error;
    return appointments || [];
  }
}
