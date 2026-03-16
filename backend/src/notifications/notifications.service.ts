import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import * as webpush from 'web-push';
import { randomUUID } from 'crypto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const email = this.config.get<string>('VAPID_EMAIL', 'mailto:contato@barbearia.com');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
      this.logger.log('VAPID keys configured');
    } else {
      this.logger.warn('VAPID keys not configured - push notifications disabled');
    }
  }

  async saveSubscription(clientId: string, subscription: webpush.PushSubscription) {
    // Remove subscriptions antigas do mesmo endpoint
    await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint);

    const { error } = await this.supabase.from('push_subscriptions').insert({
      id: randomUUID(),
      clientId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      createdAt: new Date().toISOString(),
    });

    if (error) throw error;
  }

  async removeSubscription(endpoint: string) {
    await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
  }

  private async sendPush(subscription: any, payload: object) {
    const pushSub = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };

    try {
      await webpush.sendNotification(pushSub, JSON.stringify(payload));
    } catch (err: any) {
      // Se a subscription expirou/foi revogada, remove
      if (err.statusCode === 410 || err.statusCode === 404) {
        this.logger.log(`Removing expired subscription: ${subscription.endpoint}`);
        await this.removeSubscription(subscription.endpoint);
      } else {
        this.logger.error(`Push failed: ${err.message}`);
      }
    }
  }

  /** Roda a cada 5 minutos — verifica agendamentos próximos */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendAppointmentReminders() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    if (!publicKey) return; // VAPID não configurado

    const now = new Date();

    // Janela: agendamentos entre 10 e 20 minutos a partir de agora
    const from = new Date(now.getTime() + 10 * 60 * 1000);
    const to = new Date(now.getTime() + 20 * 60 * 1000);

    const { data: appointments, error } = await this.supabase
      .from('appointments')
      .select('id, scheduledAt, clientId, professional:professionals(name), services:appointment_services(service:services(name))')
      .eq('status', 'SCHEDULED')
      .gte('scheduledAt', from.toISOString())
      .lte('scheduledAt', to.toISOString());

    if (error || !appointments?.length) return;

    for (const appt of appointments) {
      // Buscar subscriptions do cliente
      const { data: subs } = await this.supabase
        .from('push_subscriptions')
        .select('*')
        .eq('clientId', appt.clientId);

      if (!subs?.length) continue;

      const scheduledAt = new Date(appt.scheduledAt);
      const diffMin = Math.round((scheduledAt.getTime() - now.getTime()) / 60000);
      const time = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const profName = (appt.professional as any)?.name || 'seu profissional';
      const serviceNames = ((appt.services as any[]) || [])
        .map((s: any) => s.service?.name)
        .filter(Boolean)
        .join(', ');

      const payload = {
        title: `⏰ Faltam ${diffMin} min para seu horário!`,
        body: `${serviceNames} com ${profName} às ${time}`,
        icon: '/favicon/web-app-manifest-192x192.png',
        badge: '/favicon/favicon-96x96.png',
        data: { url: '/cliente/' },
      };

      for (const sub of subs) {
        await this.sendPush(sub, payload);
      }

      this.logger.log(`Reminder sent for appointment ${appt.id}`);
    }
  }

  /** Envia notificação customizada para um cliente */
  async notifyClient(clientId: string, title: string, body: string) {
    const { data: subs } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('clientId', clientId);

    if (!subs?.length) return;

    const payload = {
      title,
      body,
      icon: '/favicon/web-app-manifest-192x192.png',
      badge: '/favicon/favicon-96x96.png',
      data: { url: '/cliente/' },
    };

    for (const sub of subs) {
      await this.sendPush(sub, payload);
    }
  }
}
