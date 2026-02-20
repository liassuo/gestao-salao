import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateFinancialTransactionDto,
  UpdateFinancialTransactionDto,
  QueryFinancialTransactionDto,
} from './dto';

@Injectable()
export class FinancialTransactionsService {
  constructor(private readonly supabase: SupabaseService) {}

  private calculateNetAmount(
    amount: number,
    discount?: number,
    interest?: number,
  ): number {
    const discountValue = discount ? Math.round((amount * discount) / 100) : 0;
    const interestValue = interest ? Math.round((amount * interest) / 100) : 0;
    return amount - discountValue + interestValue;
  }

  async create(dto: CreateFinancialTransactionDto) {
    const netAmount = this.calculateNetAmount(dto.amount, dto.discount, dto.interest);

    const { data: transaction, error } = await this.supabase
      .from('financial_transactions')
      .insert({
        type: dto.type,
        description: dto.description,
        amount: dto.amount,
        discount: dto.discount || 0,
        interest: dto.interest || 0,
        netAmount: netAmount,
        dueDate: dto.dueDate,
        status: dto.status || 'PENDING',
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        branchId: dto.branchId,
        bankAccountId: dto.bankAccountId,
        paymentMethodConfigId: dto.paymentMethodConfigId,
        notes: dto.notes,
      })
      .select('*')
      .single();

    if (error) throw error;
    return transaction;
  }

  async findAll(query: QueryFinancialTransactionDto) {
    let queryBuilder = this.supabase.from('financial_transactions').select('*');

    if (query.type) {
      queryBuilder = queryBuilder.eq('type', query.type);
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.categoryId) {
      queryBuilder = queryBuilder.eq('categoryId', query.categoryId);
    }

    if (query.branchId) {
      queryBuilder = queryBuilder.eq('branchId', query.branchId);
    }

    if (query.startDate) {
      queryBuilder = queryBuilder.gte('dueDate', query.startDate);
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte('dueDate', query.endDate);
    }

    const { data: transactions, error } = await queryBuilder.order('dueDate', { ascending: false });

    if (error) throw error;
    return transactions || [];
  }

  async findOne(id: string) {
    const { data: transaction, error } = await this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !transaction) {
      throw new NotFoundException('Transação financeira não encontrada');
    }

    return transaction;
  }

  async update(id: string, dto: UpdateFinancialTransactionDto) {
    const { data: transaction, error: findError } = await this.supabase
      .from('financial_transactions')
      .select('amount, discount, interest')
      .eq('id', id)
      .single();

    if (findError || !transaction) {
      throw new NotFoundException('Transação financeira não encontrada');
    }

    const newAmount = dto.amount !== undefined ? dto.amount : transaction.amount;
    const newDiscount = dto.discount !== undefined ? dto.discount : transaction.discount;
    const newInterest = dto.interest !== undefined ? dto.interest : transaction.interest;
    const netAmount = this.calculateNetAmount(newAmount, newDiscount, newInterest);

    const updateData: any = { netAmount: netAmount };
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.discount !== undefined) updateData.discount = dto.discount;
    if (dto.interest !== undefined) updateData.interest = dto.interest;
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.subcategoryId !== undefined) updateData.subcategoryId = dto.subcategoryId;
    if (dto.branchId !== undefined) updateData.branchId = dto.branchId;
    if (dto.bankAccountId !== undefined) updateData.bankAccountId = dto.bankAccountId;
    if (dto.paymentMethodConfigId !== undefined) updateData.paymentMethodConfigId = dto.paymentMethodConfigId;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const { data: updated, error } = await this.supabase
      .from('financial_transactions')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async markAsPaid(id: string) {
    const { data: transaction, error: findError } = await this.supabase
      .from('financial_transactions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (findError || !transaction) {
      throw new NotFoundException('Transação financeira não encontrada');
    }

    const { data: updated, error } = await this.supabase
      .from('financial_transactions')
      .update({ status: 'PAID', paidAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async remove(id: string) {
    const { data: transaction, error: findError } = await this.supabase
      .from('financial_transactions')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !transaction) {
      throw new NotFoundException('Transação financeira não encontrada');
    }

    const { error } = await this.supabase.from('financial_transactions').delete().eq('id', id);

    if (error) throw error;
  }

  async getPayableTotals(query: QueryFinancialTransactionDto) {
    let queryBuilder = this.supabase
      .from('financial_transactions')
      .select('status, netAmount')
      .eq('type', 'EXPENSE');

    if (query.startDate) queryBuilder = queryBuilder.gte('dueDate', query.startDate);
    if (query.endDate) queryBuilder = queryBuilder.lte('dueDate', query.endDate);
    if (query.branchId) queryBuilder = queryBuilder.eq('branchId', query.branchId);

    const { data, error } = await queryBuilder;
    if (error) throw error;

    let total = 0, pending = 0, paid = 0, overdue = 0;
    for (const t of data || []) {
      total += t.netAmount;
      if (t.status === 'PENDING') pending += t.netAmount;
      if (t.status === 'PAID') paid += t.netAmount;
      if (t.status === 'OVERDUE') overdue += t.netAmount;
    }
    return { total, pending, paid, overdue };
  }

  async getReceivableTotals(query: QueryFinancialTransactionDto) {
    let queryBuilder = this.supabase
      .from('financial_transactions')
      .select('status, netAmount')
      .eq('type', 'REVENUE');

    if (query.startDate) queryBuilder = queryBuilder.gte('dueDate', query.startDate);
    if (query.endDate) queryBuilder = queryBuilder.lte('dueDate', query.endDate);
    if (query.branchId) queryBuilder = queryBuilder.eq('branchId', query.branchId);

    const { data, error } = await queryBuilder;
    if (error) throw error;

    let total = 0, pending = 0, paid = 0, overdue = 0;
    for (const t of data || []) {
      total += t.netAmount;
      if (t.status === 'PENDING') pending += t.netAmount;
      if (t.status === 'PAID') paid += t.netAmount;
      if (t.status === 'OVERDUE') overdue += t.netAmount;
    }
    return { total, pending, paid, overdue };
  }

  async getBalance(query: QueryFinancialTransactionDto) {
    const payable = await this.getPayableTotals(query);
    const receivable = await this.getReceivableTotals(query);
    return {
      payable,
      receivable,
      balance: receivable.total - payable.total,
    };
  }

  async getSummary(type?: string, startDate?: string, endDate?: string) {
    let queryBuilder = this.supabase.from('financial_transactions').select('type, status, netAmount');

    if (type) {
      queryBuilder = queryBuilder.eq('type', type);
    }

    if (startDate) {
      queryBuilder = queryBuilder.gte('dueDate', startDate);
    }

    if (endDate) {
      queryBuilder = queryBuilder.lte('dueDate', endDate);
    }

    const { data: transactions, error } = await queryBuilder;

    if (error) throw error;

    const summary = {
      totalPending: 0,
      totalPaid: 0,
      totalOverdue: 0,
      total: 0,
    };

    for (const t of transactions || []) {
      summary.total += t.netAmount;
      if (t.status === 'PENDING') summary.totalPending += t.netAmount;
      if (t.status === 'PAID') summary.totalPaid += t.netAmount;
      if (t.status === 'OVERDUE') summary.totalOverdue += t.netAmount;
    }

    return summary;
  }
}
