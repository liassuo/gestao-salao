import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async registerPayment(dto: CreatePaymentDto) {
    // 1. Verificar se o cliente existe
    const { data: client, error: clientError } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', dto.clientId)
      .single();

    if (clientError || !client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // 2. Verificar se o usuário que registra existe
    const { data: registeredByUser, error: userError } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', dto.registeredBy)
      .single();

    if (userError || !registeredByUser) {
      throw new NotFoundException('Usuário que registra não encontrado');
    }

    // 3. Se tem appointmentId, validar agendamento
    if (dto.appointmentId) {
      const { data: appointment, error: apptError } = await this.supabase
        .from('appointments')
        .select('id, isPaid, clientId')
        .eq('id', dto.appointmentId)
        .single();

      if (apptError || !appointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }

      if (appointment.isPaid) {
        throw new BadRequestException('Este agendamento já está pago');
      }

      if (appointment.clientId !== dto.clientId) {
        throw new BadRequestException('O agendamento não pertence a este cliente');
      }
    }

    // 4. Criar o pagamento
    const { data: payment, error: payError } = await this.supabase
      .from('payments')
      .insert({
        clientId: dto.clientId,
        appointmentId: dto.appointmentId,
        amount: dto.amount,
        method: dto.method,
        paidAt: dto.paidAt ?? new Date().toISOString(),
        registeredBy: dto.registeredBy,
        notes: dto.notes,
      })
      .select('*')
      .single();

    if (payError) throw payError;

    // 5. Se vinculado a agendamento, marcar como pago
    if (dto.appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: true })
        .eq('id', dto.appointmentId);
    }

    return payment;
  }

  async unlinkPayment(id: string): Promise<void> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('id, appointmentId')
      .eq('id', id)
      .single();

    if (error || !payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    // Se estava vinculado a agendamento, desmarcar como pago
    if (payment.appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: false })
        .eq('id', payment.appointmentId);
    }

    // Remover o pagamento
    await this.supabase.from('payments').delete().eq('id', id);
  }

  async findOne(id: string) {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    return payment;
  }

  async findAll() {
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('*')
      .order('paidAt', { ascending: false });

    if (error) throw error;
    return payments || [];
  }

  async findByClient(clientId: string) {
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('clientId', clientId)
      .order('paidAt', { ascending: false });

    if (error) throw error;
    return payments || [];
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('*')
      .gte('paidAt', startDate.toISOString())
      .lte('paidAt', endDate.toISOString())
      .order('paidAt', { ascending: true });

    if (error) throw error;
    return payments || [];
  }

  async findByMethod(method: string) {
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('method', method)
      .order('paidAt', { ascending: false });

    if (error) throw error;
    return payments || [];
  }

  async calculateTotalsByMethod(
    startDate: Date,
    endDate: Date,
  ): Promise<{ cash: number; pix: number; card: number; total: number }> {
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('amount, method')
      .gte('paidAt', startDate.toISOString())
      .lte('paidAt', endDate.toISOString());

    if (error) throw error;

    const totals = { cash: 0, pix: 0, card: 0, total: 0 };
    const methodMap: Record<string, keyof typeof totals> = {
      CASH: 'cash',
      PIX: 'pix',
      CARD: 'card',
    };

    for (const payment of payments || []) {
      const key = methodMap[payment.method];
      if (key) totals[key] += payment.amount;
      totals.total += payment.amount;
    }

    return totals;
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const { data: payment, error: findError } = await this.supabase
      .from('payments')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    const { data: updated, error } = await this.supabase
      .from('payments')
      .update({
        amount: dto.amount,
        method: dto.method,
        notes: dto.notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }
}
