import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto';

@Injectable()
export class BankAccountsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateBankAccountDto) {
    const { data: bankAccount, error } = await this.supabase
      .from('bank_accounts')
      .insert({
        name: dto.name,
        bank: dto.bank || null,
        account_type: dto.accountType || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return bankAccount;
  }

  async findAll() {
    const { data: bankAccounts, error } = await this.supabase
      .from('bank_accounts')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return bankAccounts || [];
  }

  async findActive() {
    const { data: bankAccounts, error } = await this.supabase
      .from('bank_accounts')
      .select('id, name, bank, account_type')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return bankAccounts || [];
  }

  async findOne(id: string) {
    const { data: bankAccount, error } = await this.supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !bankAccount) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    return bankAccount;
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    const { data: bankAccount, error: findError } = await this.supabase
      .from('bank_accounts')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !bankAccount) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.bank !== undefined) updateData.bank = dto.bank;
    if (dto.accountType !== undefined) updateData.account_type = dto.accountType;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

    const { data: updated, error } = await this.supabase
      .from('bank_accounts')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async remove(id: string) {
    const { data: bankAccount, error: findError } = await this.supabase
      .from('bank_accounts')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !bankAccount) {
      throw new NotFoundException('Conta bancária não encontrada');
    }

    const { error } = await this.supabase
      .from('bank_accounts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }
}
