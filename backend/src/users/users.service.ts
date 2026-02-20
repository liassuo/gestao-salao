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
<<<<<<< HEAD
  name: string;
  password: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
=======
  password: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // Verificar se email já existe
<<<<<<< HEAD
    const { data: existingUser } = await this.supabase
=======
    const { data: existingUser } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(dto.password, 10);

<<<<<<< HEAD
    const { data: user, error } = await this.supabase
      .from('users')
      .insert({
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: dto.role,
      })
      .select('id, email, name, role, is_active, created_at, updated_at')
      .single();
=======
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
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95

    if (error) throw error;

    return user;
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
<<<<<<< HEAD
    const { data: users, error } = await this.supabase
      .from('users')
      .select('id, email, name, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });
=======
    const { data: users, error } = await this.supabase.client
      .from('users')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95

    if (error) throw error;

    return users || [];
  }

  async findOne(id: string): Promise<Omit<User, 'password'>> {
<<<<<<< HEAD
    const { data: user, error } = await this.supabase
      .from('users')
      .select('id, email, name, role, is_active, created_at, updated_at')
=======
    const { data: user, error } = await this.supabase.client
      .from('users')
      .select('*')
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
<<<<<<< HEAD
    const { data: user } = await this.supabase
=======
    const { data: user } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return user;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
<<<<<<< HEAD
    const { data: user } = await this.supabase
=======
    const { data: user } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'password'>> {
<<<<<<< HEAD
    const { data: user, error: findError } = await this.supabase
=======
    const { data: existingUser, error: findError } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

<<<<<<< HEAD
    if (findError || !user) {
=======
    if (findError || !existingUser) {
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      throw new NotFoundException('Usuário não encontrado');
    }

    // Se está atualizando a senha, fazer hash
<<<<<<< HEAD
    const updateData: any = { ...dto };
=======
    let updateData: any = { ...dto, updatedAt: new Date().toISOString() };
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

<<<<<<< HEAD
    const { data: updatedUser, error } = await this.supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, name, role, is_active, created_at, updated_at')
      .single();
=======
    const { data: updatedUser, error } = await this.supabase.client
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95

    if (error) throw error;

    return updatedUser;
  }

  async remove(id: string): Promise<void> {
<<<<<<< HEAD
    const { data: user, error: findError } = await this.supabase
=======
    const { data: user, error: findError } = await this.supabase.client
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Soft delete
<<<<<<< HEAD
    const { error } = await this.supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
=======
    const { error } = await this.supabase.client
      .from('users')
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
