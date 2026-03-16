import { Injectable } from '@nestjs/common';
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
