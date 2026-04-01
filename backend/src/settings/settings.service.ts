import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async get() {
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      // Retorna defaults se não existir
      return {
        businessName: '',
        phone: '',
        whatsapp: '',
        address: '',
        openingTime: '09:00',
        closingTime: '19:00',
        slotDuration: 30,
        emailNotifications: true,
        smsNotifications: false,
        appointmentReminders: true,
        reminderHoursBefore: 24,
      };
    }

    // Nunca retornar o hash do PIN
    if (data) {
      const { commissionPin, ...safe } = data;
      return { ...safe, hasCommissionPin: !!commissionPin };
    }

    return data;
  }

  async update(dto: UpdateSettingsDto) {
    // Verifica se já existe um registro
    const { data: existing } = await this.supabase
      .from('settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await this.supabase
        .from('settings')
        .update({ ...dto, updatedAt: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('settings')
        .insert({
          ...dto,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    }
  }

  async setCommissionPin(pin: string) {
    if (!pin || pin.length < 4 || pin.length > 6) {
      throw new BadRequestException('O PIN deve ter entre 4 e 6 caracteres');
    }

    const hashedPin = await bcrypt.hash(pin, 6);

    const { data: existing } = await this.supabase
      .from('settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      await this.supabase
        .from('settings')
        .update({ commissionPin: hashedPin, updatedAt: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await this.supabase.from('settings').insert({
        commissionPin: hashedPin,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true };
  }

  async removeCommissionPin() {
    const { data: existing } = await this.supabase
      .from('settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      await this.supabase
        .from('settings')
        .update({ commissionPin: null, updatedAt: new Date().toISOString() })
        .eq('id', existing.id);
    }

    return { success: true };
  }

  async verifyCommissionPin(pin: string): Promise<{ valid: boolean }> {
    const { data } = await this.supabase
      .from('settings')
      .select('commissionPin')
      .limit(1)
      .single();

    if (!data?.commissionPin) {
      // Se não tem PIN configurado, acesso livre
      return { valid: true };
    }

    const valid = await bcrypt.compare(pin, data.commissionPin);
    return { valid };
  }

  /** Retorna só o WhatsApp (endpoint público para o app do cliente) */
  async getWhatsapp(): Promise<string> {
    const { data } = await this.supabase
      .from('settings')
      .select('whatsapp')
      .limit(1)
      .single();

    return data?.whatsapp || '';
  }
}
