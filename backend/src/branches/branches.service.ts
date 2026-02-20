import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@Injectable()
export class BranchesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateBranchDto) {
    const { data: branch, error } = await this.supabase
      .from('branches')
      .insert({
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
      })
      .select('*')
      .single();

    if (error) throw error;
    return branch;
  }

  async findAll() {
    const { data: branches, error } = await this.supabase
      .from('branches')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return branches || [];
  }

  async findActive() {
    const { data: branches, error } = await this.supabase
      .from('branches')
      .select('id, name, address, phone')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return branches || [];
  }

  async findOne(id: string) {
    const { data: branch, error } = await this.supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    const { data: branch, error: findError } = await this.supabase
      .from('branches')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    const { data: updated, error } = await this.supabase
      .from('branches')
      .update(dto)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  async remove(id: string) {
    const { data: branch, error: findError } = await this.supabase
      .from('branches')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    const { error } = await this.supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }
}
