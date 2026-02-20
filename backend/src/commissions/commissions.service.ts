import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GenerateCommissionDto, QueryCommissionDto } from './dto';

@Injectable()
export class CommissionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async generate(dto: GenerateCommissionDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('A data de início deve ser anterior à data de fim');
    }

    const { data: appointments } = await this.supabase
      .from('appointments')
      .select('professional_id, total_price')
      .eq('status', 'ATTENDED')
      .gte('scheduled_at', startDate.toISOString())
      .lte('scheduled_at', endDate.toISOString());

    if (!appointments || appointments.length === 0) {
      throw new BadRequestException('Nenhum atendimento encontrado no período informado');
    }

    const groupedByProfessional = new Map<string, number>();

    for (const appointment of appointments) {
      const existing = groupedByProfessional.get(appointment.professional_id) || 0;
      groupedByProfessional.set(appointment.professional_id, existing + appointment.total_price);
    }

    const createdCommissions = [];

    for (const [professionalId, totalPrice] of groupedByProfessional) {
      const { data: professional } = await this.supabase
        .from('professionals')
        .select('id, commission_rate, branch_id')
        .eq('id', professionalId)
        .single();

      if (!professional || !professional.commission_rate) continue;

      const commissionAmount = Math.round((totalPrice * professional.commission_rate) / 100);

      if (commissionAmount <= 0) continue;

      const { data: commission, error } = await this.supabase
        .from('commissions')
        .insert({
          amount: commissionAmount,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          status: 'PENDING',
          professional_id: professionalId,
          branch_id: professional.branch_id,
        })
        .select('*')
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
    let queryBuilder = this.supabase.from('commissions').select('*');

    if (query.professionalId) {
      queryBuilder = queryBuilder.eq('professional_id', query.professionalId);
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('period_start', new Date(query.startDate).toISOString());
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('period_start', new Date(query.endDate).toISOString());
    }

    const { data: commissions, error } = await queryBuilder.order('created_at', { ascending: false });

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

    const { data: updated, error: updateError } = await this.supabase
      .from('commissions')
      .update({ status: 'PAID', paid_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
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
