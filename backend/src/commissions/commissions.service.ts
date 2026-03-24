import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { GenerateCommissionDto, QueryCommissionDto } from './dto';

@Injectable()
export class CommissionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async generate(dto: GenerateCommissionDto) {
    if (dto.periodStart >= dto.periodEnd) {
      throw new BadRequestException('A data de início deve ser anterior à data de fim');
    }

    const startStr = `${dto.periodStart}T00:00:00`;
    const endStr = `${dto.periodEnd}T23:59:59`;

    const { data: appointments } = await this.supabase
      .from('appointments')
      .select('professionalId, totalPrice')
      .eq('status', 'ATTENDED')
      .gte('scheduledAt', startStr)
      .lte('scheduledAt', endStr);

    if (!appointments || appointments.length === 0) {
      throw new BadRequestException('Nenhum atendimento encontrado no período informado');
    }

    const groupedByProfessional = new Map<string, number>();

    for (const appointment of appointments) {
      const existing = groupedByProfessional.get(appointment.professionalId) || 0;
      groupedByProfessional.set(appointment.professionalId, existing + appointment.totalPrice);
    }

    const createdCommissions = [];

    for (const [professionalId, totalPrice] of groupedByProfessional) {
      const { data: professional } = await this.supabase
        .from('professionals')
        .select('id, commissionRate, branchId')
        .eq('id', professionalId)
        .single();

      if (!professional || !professional.commissionRate) continue;

      const commissionAmount = Math.round((totalPrice * professional.commissionRate) / 100);

      if (commissionAmount <= 0) continue;

      const d = new Date();
      const comNow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const { data: commission, error } = await this.supabase
        .from('commissions')
        .insert({
          id: randomUUID(),
          amount: commissionAmount,
          periodStart: startStr,
          periodEnd: endStr,
          status: 'PENDING',
          professionalId: professionalId,
          branchId: professional.branchId,
          createdAt: comNow,
          updatedAt: comNow,
        })
        .select('*, professional:professionals(id, name, commissionRate)')
        .single();

      if (!error) createdCommissions.push(commission);
    }

    if (createdCommissions.length === 0) {
      throw new BadRequestException(
        'Nenhuma comissão gerada. Verifique se os profissionais possuem taxa de comissão configurada',
      );
    }

    return createdCommissions;
  }

  async findAll(query: QueryCommissionDto) {
    let queryBuilder = this.supabase
      .from('commissions')
      .select('*, professional:professionals(id, name, commissionRate)');

    if (query.professionalId) {
      queryBuilder = queryBuilder.eq('professionalId', query.professionalId);
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('periodStart', `${query.startDate}T00:00:00`);
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('periodStart', `${query.endDate}T23:59:59`);
    }

    const { data: commissions, error } = await queryBuilder.order('createdAt', { ascending: false });

    if (error) throw error;
    return commissions || [];
  }

  async findOne(id: string) {
    const { data: commission, error } = await this.supabase
      .from('commissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    return commission;
  }

  async markAsPaid(id: string) {
    const { data: commission, error } = await this.supabase
      .from('commissions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (error || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    if (commission.status === 'PAID') {
      throw new BadRequestException('Esta comissão já foi paga');
    }

    const d = new Date();
    const paidNow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const { data: updated, error: updateError } = await this.supabase
      .from('commissions')
      .update({ status: 'PAID', paidAt: paidNow })
      .eq('id', id)
      .select('*, professional:professionals(id, name, commissionRate)')
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  async remove(id: string) {
    const { data: commission, error: findError } = await this.supabase
      .from('commissions')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !commission) {
      throw new NotFoundException('Comissão não encontrada');
    }

    const { error } = await this.supabase.from('commissions').delete().eq('id', id);

    if (error) throw error;
  }
}
