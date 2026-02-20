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
  name: string;
  password: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const { data: user, error } = await this.supabase
      .from('users')
      .insert({
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: dto.role,
        isActive: true,
        updatedAt: new Date().toISOString(),
      })
      .select('id, email, name, role, isActive, createdAt, updatedAt')
      .single();

    if (error) throw error;

    return user;
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const { data: users, error } = await this.supabase
      .from('users')
      .select('id, email, name, role, isActive, createdAt, updatedAt')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    return users || [];
  }

  async findOne(id: string): Promise<Omit<User, 'password'>> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('id, email, name, role, isActive, createdAt, updatedAt')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return user;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    const { data: user, error: findError } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const updateData: any = { ...dto, updatedAt: new Date().toISOString() };
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const { data: updatedUser, error } = await this.supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, name, role, isActive, createdAt, updatedAt')
      .single();

    if (error) throw error;

    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const { data: user, error: findError } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const { error } = await this.supabase
      .from('users')
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
