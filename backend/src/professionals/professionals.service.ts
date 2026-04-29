import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProfessionalDto, UpdateProfessionalDto, CreateVacationDto, UpdateVacationDto } from './dto';

// Retorna a data atual no fuso de Brasília no formato "YYYY-MM-DD".
// Usado para detectar férias ativas sem depender do fuso do servidor.
function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Normaliza um valor vindo do banco (DATE/timestamp/string ISO) para "YYYY-MM-DD",
// preservando o dia "literal" (sem conversão de fuso). Para colunas DATE, o
// supabase-js retorna "YYYY-MM-DD"; para timestamp ele pode retornar com hora.
function normalizeDate(value: any): string {
  if (!value) return '';
  const s = String(value);
  return s.length >= 10 ? s.substring(0, 10) : s;
}

@Injectable()
export class ProfessionalsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateProfessionalDto) {
    // Verificar se email já existe na tabela users
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existingUser) {
      throw new ConflictException('Email já cadastrado no sistema');
    }

    const now = new Date().toISOString();
    const professionalId = randomUUID();

    const { data: professional, error } = await this.supabase
      .from('professionals')
      .insert({
        id: professionalId,
        name: dto.name,
        avatarUrl: dto.avatarUrl || null,
        commissionRate: dto.commissionRate,
        workingHours: dto.workingHours || [],
        branchId: dto.branchId || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Auto-criar conta de usuário para o profissional fazer login (senha padrão: 123456)
    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 6);

    const userId = randomUUID();
    const { error: userError } = await this.supabase
      .from('users')
      .insert({
        id: userId,
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: 'PROFESSIONAL',
        professionalId: professionalId,
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      });

    if (userError) {
      console.error('Erro ao criar conta de login para profissional:', JSON.stringify(userError));
    } else {
      // Atualizar o profissional com o userId criado
      await this.supabase
        .from('professionals')
        .update({ userId })
        .eq('id', professionalId);
    }

    // Connect services if provided
    if (dto.serviceIds?.length) {
      for (const serviceId of dto.serviceIds) {
        await this.supabase.from('professional_services').insert({
          id: randomUUID(),
          professionalId: professional.id,
          serviceId: serviceId,
        });
      }
    }

    return professional;
  }

  async findAll(serviceId?: string, isActive?: boolean) {
    let query = this.supabase
      .from('professionals')
      .select('*, appointment_count:appointments(count), professional_services(serviceId, service:services(id, name))');

    if (isActive !== undefined) {
      query = query.eq('isActive', isActive);
    } else {
      query = query.eq('isActive', true);
    }

    const { data: professionals, error } = await query.order('name', { ascending: true });

    if (error) throw error;

    const profList = professionals || [];

    // Buscar emails dos users vinculados (via professionalId)
    const profIds = profList.map((p: any) => p.id);
    const emailMap: Record<string, string> = {};
    if (profIds.length > 0) {
      const { data: users } = await this.supabase
        .from('users')
        .select('professionalId, email')
        .in('professionalId', profIds);
      for (const u of users || []) {
        if (u.professionalId) emailMap[u.professionalId] = u.email;
      }
    }

    // Buscar férias ativas/futuras (endDate >= hoje em Brasília)
    const today = todayInBrazil();
    const vacationsByProf = await this.getVacationsByProf(profIds, today);

    return profList.map(({ appointment_count, professional_services, ...prof }: any) => ({
      ...prof,
      email: emailMap[prof.id] || null,
      services: (professional_services || []).map((ps: any) => ({
        id: ps.service?.id || ps.serviceId,
        name: ps.service?.name,
      })),
      vacations: vacationsByProf[prof.id] || [],
      currentVacation: this.findActiveVacation(vacationsByProf[prof.id] || [], today),
      _count: {
        appointments: appointment_count?.[0]?.count || 0,
      },
    }));
  }

  /**
   * Busca todas as férias futuras/atuais (endDate >= today) dos profissionais
   * informados, agrupadas por professionalId. Datas vêm normalizadas para
   * "YYYY-MM-DD" (sem horário/fuso).
   */
  private async getVacationsByProf(
    profIds: string[],
    today: string,
  ): Promise<Record<string, Array<{ id: string; startDate: string; endDate: string; reason: string | null }>>> {
    if (profIds.length === 0) return {};
    try {
      const { data: vacations } = await this.supabase
        .from('professional_vacations')
        .select('id, professionalId, startDate, endDate, reason')
        .in('professionalId', profIds)
        .gte('endDate', today)
        .order('startDate', { ascending: true });

      const map: Record<string, any[]> = {};
      for (const v of vacations || []) {
        const item = {
          id: v.id,
          startDate: normalizeDate(v.startDate),
          endDate: normalizeDate(v.endDate),
          reason: v.reason ?? null,
        };
        if (!map[v.professionalId]) map[v.professionalId] = [];
        map[v.professionalId].push(item);
      }
      return map;
    } catch {
      // Se a tabela ainda não existir, ignorar (retorna vazio)
      return {};
    }
  }

  /**
   * Dado um array de férias e a data de hoje (YYYY-MM-DD em Brasília),
   * retorna a férias que cobre hoje (se houver) ou null.
   */
  private findActiveVacation(
    vacations: Array<{ id: string; startDate: string; endDate: string; reason: string | null }>,
    today: string,
  ) {
    return (
      vacations.find((v) => v.startDate <= today && today <= v.endDate) || null
    );
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
      .select('*, professional_services(serviceId, service:services(id, name))')
      .eq('id', id)
      .single();

    if (error || !professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    // Buscar email do user vinculado
    const { data: user } = await this.supabase
      .from('users')
      .select('email')
      .eq('professionalId', id)
      .single();

    const today = todayInBrazil();
    const vacationsByProf = await this.getVacationsByProf([id], today);
    const vacations = vacationsByProf[id] || [];

    const { professional_services, ...prof } = professional as any;
    return {
      ...prof,
      email: user?.email || null,
      services: (professional_services || []).map((ps: any) => ({
        id: ps.service?.id || ps.serviceId,
        name: ps.service?.name,
      })),
      vacations,
      currentVacation: this.findActiveVacation(vacations, today),
    };
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
    // 1. Buscar profissionais vinculados aos serviços via professional_services
    const { data: links, error: linkError } = await this.supabase
      .from('professional_services')
      .select('professionalId, serviceId')
      .in('serviceId', serviceIds);

    if (linkError) {
      throw new Error(`Erro ao buscar serviços: ${linkError.message}`);
    }

    // Filtrar profissionais que atendem TODOS os serviços selecionados
    const profCountMap: Record<string, number> = {};
    for (const link of links || []) {
      profCountMap[link.professionalId] = (profCountMap[link.professionalId] || 0) + 1;
    }
    const eligibleProfIds = Object.entries(profCountMap)
      .filter(([, count]) => count >= serviceIds.length)
      .map(([id]) => id);

    if (eligibleProfIds.length === 0) return [];

    // 2. Buscar dados dos profissionais ativos
    const { data: professionals, error: profError } = await this.supabase
      .from('professionals')
      .select('id, name, avatarUrl, workingHours')
      .eq('isActive', true)
      .in('id', eligibleProfIds);

    if (profError) {
      throw new Error(`Erro ao buscar profissionais: ${profError.message}`);
    }
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
    const blockedProfIds = new Set<string>();
    try {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const { data: timeBlocks } = await this.supabase
        .from('time_blocks')
        .select('professionalId, startTime, endTime')
        .in('professionalId', workingProfessionals.map((p: any) => p.id))
        .lte('startTime', endOfDay)
        .gte('endTime', startOfDay);

      for (const block of timeBlocks || []) {
        const blockStart = new Date(block.startTime);
        const blockEnd = new Date(block.endTime);
        const blockHours = (blockEnd.getTime() - blockStart.getTime()) / (1000 * 60 * 60);
        if (blockHours >= 8) {
          blockedProfIds.add(block.professionalId);
        }
      }
    } catch {
      // Se a tabela time_blocks não existir, ignorar bloqueios
    }

    // 5. Buscar férias atuais/futuras dos profissionais
    const today = todayInBrazil();
    const vacationsByProf = await this.getVacationsByProf(
      workingProfessionals.map((p: any) => p.id),
      today,
    );

    return workingProfessionals
      .filter((p: any) => !blockedProfIds.has(p.id))
      .map((p: any) => {
        const vacations = vacationsByProf[p.id] || [];
        // Verificar se profissional está de férias na data SOLICITADA (não em "hoje")
        const onVacationOnDate = vacations.find(
          (v) => v.startDate <= date && date <= v.endDate,
        );
        return {
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          vacations,
          currentVacation: this.findActiveVacation(vacations, today),
          vacationOnDate: onVacationOnDate || null,
        };
      });
  }

  // ==================== FÉRIAS ====================

  async listVacations(professionalId: string) {
    // Garante que o profissional existe
    const { data: prof } = await this.supabase
      .from('professionals')
      .select('id')
      .eq('id', professionalId)
      .single();
    if (!prof) throw new NotFoundException('Profissional não encontrado');

    const { data, error } = await this.supabase
      .from('professional_vacations')
      .select('id, professionalId, startDate, endDate, reason, createdAt, updatedAt')
      .eq('professionalId', professionalId)
      .order('startDate', { ascending: false });

    if (error) throw error;

    return (data || []).map((v: any) => ({
      ...v,
      startDate: normalizeDate(v.startDate),
      endDate: normalizeDate(v.endDate),
    }));
  }

  async createVacation(professionalId: string, dto: CreateVacationDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('A data final deve ser igual ou posterior à inicial');
    }

    const { data: prof } = await this.supabase
      .from('professionals')
      .select('id')
      .eq('id', professionalId)
      .single();
    if (!prof) throw new NotFoundException('Profissional não encontrado');

    // Verificar sobreposição com férias existentes
    const { data: overlapping } = await this.supabase
      .from('professional_vacations')
      .select('id, startDate, endDate')
      .eq('professionalId', professionalId)
      .lte('startDate', dto.endDate)
      .gte('endDate', dto.startDate);

    if (overlapping && overlapping.length > 0) {
      throw new ConflictException(
        'Este período sobrepõe outras férias já cadastradas para o profissional',
      );
    }

    const now = new Date().toISOString();
    const id = randomUUID();

    const { data, error } = await this.supabase
      .from('professional_vacations')
      .insert({
        id,
        professionalId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason || null,
        createdAt: now,
        updatedAt: now,
      })
      .select('id, professionalId, startDate, endDate, reason, createdAt, updatedAt')
      .single();

    if (error) throw error;

    return {
      ...data,
      startDate: normalizeDate(data.startDate),
      endDate: normalizeDate(data.endDate),
    };
  }

  async updateVacation(
    professionalId: string,
    vacationId: string,
    dto: UpdateVacationDto,
  ) {
    const { data: existing } = await this.supabase
      .from('professional_vacations')
      .select('id, startDate, endDate')
      .eq('id', vacationId)
      .eq('professionalId', professionalId)
      .single();
    if (!existing) throw new NotFoundException('Férias não encontradas');

    const newStart = dto.startDate || normalizeDate(existing.startDate);
    const newEnd = dto.endDate || normalizeDate(existing.endDate);
    if (newEnd < newStart) {
      throw new BadRequestException('A data final deve ser igual ou posterior à inicial');
    }

    // Sobreposição (excluindo o próprio registro)
    const { data: overlapping } = await this.supabase
      .from('professional_vacations')
      .select('id')
      .eq('professionalId', professionalId)
      .neq('id', vacationId)
      .lte('startDate', newEnd)
      .gte('endDate', newStart);

    if (overlapping && overlapping.length > 0) {
      throw new ConflictException(
        'Este período sobrepõe outras férias já cadastradas para o profissional',
      );
    }

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (dto.startDate !== undefined) updateData.startDate = dto.startDate;
    if (dto.endDate !== undefined) updateData.endDate = dto.endDate;
    if (dto.reason !== undefined) updateData.reason = dto.reason || null;

    const { data, error } = await this.supabase
      .from('professional_vacations')
      .update(updateData)
      .eq('id', vacationId)
      .select('id, professionalId, startDate, endDate, reason, createdAt, updatedAt')
      .single();

    if (error) throw error;
    return {
      ...data,
      startDate: normalizeDate(data.startDate),
      endDate: normalizeDate(data.endDate),
    };
  }

  async deleteVacation(professionalId: string, vacationId: string) {
    const { data: existing } = await this.supabase
      .from('professional_vacations')
      .select('id')
      .eq('id', vacationId)
      .eq('professionalId', professionalId)
      .single();
    if (!existing) throw new NotFoundException('Férias não encontradas');

    const { error } = await this.supabase
      .from('professional_vacations')
      .delete()
      .eq('id', vacationId);

    if (error) throw error;
  }

  /**
   * Verifica se o profissional está de férias na data informada.
   * `date` deve estar no formato "YYYY-MM-DD".
   * Retorna a férias correspondente se existir, ou null.
   */
  async getVacationOnDate(
    professionalId: string,
    date: string,
  ): Promise<{ id: string; startDate: string; endDate: string; reason: string | null } | null> {
    try {
      const { data } = await this.supabase
        .from('professional_vacations')
        .select('id, startDate, endDate, reason')
        .eq('professionalId', professionalId)
        .lte('startDate', date)
        .gte('endDate', date)
        .limit(1)
        .maybeSingle();

      if (!data) return null;
      return {
        id: data.id,
        startDate: normalizeDate(data.startDate),
        endDate: normalizeDate(data.endDate),
        reason: data.reason ?? null,
      };
    } catch {
      return null;
    }
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
            id: randomUUID(),
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

  async hardDelete(id: string) {
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
      .delete()
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
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select('id, scheduledAt, totalDuration, status, clients(name)')
      .eq('professionalId', professionalId)
      .gte('scheduledAt', `${dateStr}T00:00:00`)
      .lte('scheduledAt', `${dateStr}T23:59:59`)
      .in('status', ['SCHEDULED', 'ATTENDED'])
      .order('scheduledAt', { ascending: true });

    if (error) throw error;
    return appointments || [];
  }
}
