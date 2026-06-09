import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { nowLocalIsoString, resolveBusinessDate } from '../common/datetime.util';
import { fetchPaymentsByBusinessDate } from '../common/business-date.helper';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cashRegisterService: CashRegisterService,
  ) {}

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
    let appointmentScheduledAt: string | null = null;
    if (dto.appointmentId) {
      const { data: appointment, error: apptError } = await this.supabase
        .from('appointments')
        .select('id, isPaid, clientId, scheduledAt')
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

      appointmentScheduledAt = (appointment as any).scheduledAt ?? null;
    }

    // 4. Criar o pagamento
    const d = new Date();
    const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const paidAt = dto.paidAt ? String(dto.paidAt) : now;
    // Data contábil: dia do atendimento quando vinculado a agendamento; senão o
    // dia do pagamento (balcão/avulso).
    const businessDate = resolveBusinessDate(appointmentScheduledAt, paidAt);
    const { data: payment, error: payError } = await this.supabase
      .from('payments')
      .insert({
        id: randomUUID(),
        clientId: dto.clientId,
        appointmentId: dto.appointmentId,
        amount: dto.amount,
        method: dto.method,
        paidAt,
        businessDate,
        registeredBy: dto.registeredBy,
        notes: dto.notes,
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (payError) throw payError;

    // 5. Se vinculado a agendamento, marcar como pago + pagar comanda vinculada
    if (dto.appointmentId) {
      await this.supabase
        .from('appointments')
        .update({ isPaid: true })
        .eq('id', dto.appointmentId);

      // Pagar comanda vinculada ao agendamento
      await this.supabase
        .from('orders')
        .update({ status: 'PAID', paymentId: payment.id, updatedAt: nowLocalIsoString() })
        .eq('appointmentId', dto.appointmentId)
        .eq('status', 'PENDING');
    }

    // 6. Vincular ao caixa do DIA CONTÁBIL (do atendimento, quando houver). Se o
    // caixa daquele dia já estiver fechado, o serviço recalcula seus totais.
    if (payment) {
      await this.cashRegisterService.linkPaymentToBusinessDateRegister(
        payment.id,
        businessDate,
      );
    }

    return payment;
  }

  async unlinkPayment(id: string): Promise<void> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('id, appointmentId, businessDate, paidAt')
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

    // Recalcular o caixa do DIA CONTÁBIL do pagamento excluído. O caixa ABERTO
    // recompõe os totais em tempo real; o problema é o caixa FECHADO, cujos totais
    // ficam persistidos na coluna — sem este recálculo a receita do pagamento
    // excluído continua "fantasma" no caixa fechado (e infla Total Faturado e a
    // discrepância). Mesma blindagem aplicada ao estorno Asaas. Captura o dia
    // contábil ANTES de apagar; o link no pagamento já inexistente é no-op e o
    // recálculo lê os pagamentos restantes.
    const accountingDate =
      (payment as any).businessDate || (payment as any).paidAt || null;
    if (accountingDate) {
      try {
        await this.cashRegisterService.linkPaymentToBusinessDateRegister(
          id,
          String(accountingDate),
        );
      } catch {
        // Falha no recálculo não deve reverter a exclusão já efetivada.
      }
    }
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

  async findByDateRange(startDate: string, endDate: string) {
    const { data: payments, error } = await this.supabase
      .from('payments')
      .select('*')
      .gte('paidAt', startDate)
      .lte('paidAt', endDate)
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
    startDate: string,
    endDate: string,
  ): Promise<{ cash: number; pix: number; card: number; total: number }> {
    // Totais por método pelo DIA CONTÁBIL (businessDate, fallback paidAt).
    const payments = await fetchPaymentsByBusinessDate(
      this.supabase,
      'amount, method',
      startDate,
      endDate,
    );

    const totals = { cash: 0, pix: 0, card: 0, total: 0 };
    const methodMap: Record<string, keyof typeof totals> = {
      CASH: 'cash',
      PIX: 'pix',
      CARD: 'card',
    };

    for (const payment of payments) {
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
