import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // Verificar se email já existe
    const { data: existingUser } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const { data: user, error } = await this.supabase.client
      .from('users')
      .insert({
        ...dto,
        password: hashedPassword,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Nunca retornar a senha
    const { password, ...result } = user;
    return result;
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const { data: users, error } = await this.supabase.client
      .from('users')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return users.map(({ password, ...user }) => user);
  }

  async findOne(id: string): Promise<Omit<User, 'password'>> {
    const { data: user, error } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data: user } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return user;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    const { data: user } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    const { data: existingUser, error: findError } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existingUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Se está atualizando a senha, fazer hash
    let updateData: any = { ...dto, updatedAt: new Date().toISOString() };
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const { data: updatedUser, error } = await this.supabase.client
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const { password, ...result } = updatedUser;
    return result;
  }

  async remove(id: string): Promise<void> {
    const { data: user, error: findError } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Soft delete
    const { error } = await this.supabase.client
      .from('users')
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
