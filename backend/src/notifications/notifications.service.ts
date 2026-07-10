import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import * as webpush from 'web-push';
import { randomUUID } from 'crypto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /**
   * Registra um envio em notification_log para NÃO repetir (anti-flood). Retorna
   * true se PODE enviar (não enviado ainda), false se já foi enviado.
   * Usa o índice UNIQUE em dedupeKey: o insert falha no 2º envio do mesmo aviso.
   */
  private async claimNotification(
    dedupeKey: string,
    kind: string,
    clientId: string | null,
    channel: string,
  ): Promise<boolean> {
    const { error } = await this.supabase.from('notification_log').insert({
      id: randomUUID(),
      dedupeKey,
      kind,
      clientId,
      channel,
      createdAt: new Date().toISOString(),
    });
    // 23505 = unique_violation → já foi enviado antes.
    if (error) {
      if ((error as any).code === '23505') return false;
      // Outro erro (ex: tabela não existe ainda): loga e deixa enviar (não trava o aviso).
      this.logger.warn(`claimNotification falhou (${dedupeKey}): ${error.message}`);
    }
    return true;
  }

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

  async saveSubscription(userId: string, subscription: webpush.PushSubscription, role: 'CLIENT' | 'STAFF' = 'CLIENT') {
    // Remove subscriptions antigas do mesmo endpoint
    await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint);

    const { error } = await this.supabase.from('push_subscriptions').insert({
      id: randomUUID(),
      clientId: role === 'CLIENT' ? userId : null,
      userId: role === 'STAFF' ? userId : null,
      role,
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

  /**
   * Lembrete de agendamento por E-MAIL, na manhã do dia (08:00). Complementa o push
   * (que é 10-20 min antes e exige o cliente ter autorizado) — alcança quem não tem
   * push. 1 e-mail por agendamento/dia (dedup por notification_log). Só quem tem
   * e-mail cadastrado recebe; sem e-mail é ignorado sem erro.
   */
  @Cron('0 8 * * *')
  async sendAppointmentReminderEmails() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: appointments } = await this.supabase
      .from('appointments')
      .select(
        'id, scheduledAt, clientId, client:clients(name, email), professional:professionals(name), services:appointment_services(service:services(name))',
      )
      .eq('status', 'SCHEDULED')
      .gte('scheduledAt', startOfDay.toISOString())
      .lte('scheduledAt', endOfDay.toISOString());

    if (!appointments?.length) return;

    let sent = 0;
    for (const appt of appointments as any[]) {
      const email = appt.client?.email;
      if (!email) continue; // sem e-mail → não envia (decisão do dono)

      const dedupeKey = `appt-reminder:${appt.id}`;
      if (!(await this.claimNotification(dedupeKey, 'APPOINTMENT_REMINDER', appt.clientId, 'EMAIL'))) {
        continue; // já enviado hoje
      }

      const scheduledAt = new Date(appt.scheduledAt);
      const time = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const profName = appt.professional?.name || '';
      const serviceNames = (appt.services || []).map((s: any) => s.service?.name).filter(Boolean).join(', ');

      await this.mail.sendAppointmentReminderEmail(email, appt.client?.name || 'cliente', time, profName, serviceNames);
      sent++;
    }
    if (sent > 0) this.logger.log(`[appt-reminder-email] ${sent} lembrete(s) de agendamento enviados por e-mail`);
  }

  /**
   * Aviso de assinatura próxima do vencimento por E-MAIL. Roda 1x/dia (09:00) e
   * avisa em DOIS momentos: 3 dias antes e no dia do vencimento. Controlado para
   * NÃO floodar (o Asaas foi desligado por mandar demais) — dedup por
   * notification_log garante no máximo 1 e-mail por marco. Só ACTIVE com e-mail.
   */
  @Cron('0 9 * * *')
  async sendSubscriptionExpiryReminders() {
    const now = new Date();
    const renewUrl = (this.config.get<string>('CLIENT_APP_URL') || 'https://barbeariaamerica.com.br').replace(/\/+$/, '') + '/planos';

    // Assinaturas ACTIVE que vencem nos próximos 3 dias (inclui hoje).
    const limite = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    limite.setHours(23, 59, 59, 999);

    const { data: subs } = await this.supabase
      .from('client_subscriptions')
      .select('id, endDate, clientId, client:clients(name, email), plan:subscription_plans!planId(name)')
      .eq('status', 'ACTIVE')
      .gte('endDate', now.toISOString())
      .lte('endDate', limite.toISOString());

    if (!subs?.length) return;

    let sent = 0;
    for (const sub of subs as any[]) {
      const email = sub.client?.email;
      if (!email || !sub.endDate) continue; // sem e-mail → não envia

      const end = new Date(sub.endDate);
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      // Só os marcos definidos: 3 dias antes e no dia (0). Os dias 2 e 1 não disparam
      // e-mail (evita flood) — quem caiu no marco de 3 dias já foi avisado.
      let marco: '3d' | '0d' | null = null;
      if (daysLeft >= 3) marco = '3d';
      else if (daysLeft <= 0) marco = '0d';
      else continue;

      const cycleEnd = sub.endDate.slice(0, 10);
      const dedupeKey = `sub-expiry:${sub.id}:${cycleEnd}:${marco}`;
      if (!(await this.claimNotification(dedupeKey, 'SUB_EXPIRY', sub.clientId, 'EMAIL'))) {
        continue; // já avisado neste marco/ciclo
      }

      await this.mail.sendSubscriptionExpiringEmail(
        email,
        sub.client?.name || 'cliente',
        sub.plan?.name || 'sua assinatura',
        Math.max(0, daysLeft),
        renewUrl,
      );
      sent++;
    }
    if (sent > 0) this.logger.log(`[sub-expiry] ${sent} aviso(s) de vencimento enviados por e-mail`);
  }

  /**
   * Avisa o CLIENTE que a assinatura venceu sem pagamento e virou dívida
   * (chamado na criação da dívida: webhook OVERDUE e suspend-expired-cron).
   * Push + e-mail, com dedupe por ciclo via notification_log — reprocessamento
   * do webhook/cron não manda o aviso duas vezes. Fire-and-forget: nunca lança.
   */
  async notifySubscriptionOverdue(input: {
    clientId: string;
    subscriptionId: string;
    planName: string;
    amountCentavos: number;
    cycleKey: string;
  }): Promise<void> {
    try {
      const valor = (input.amountCentavos / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      const title = 'Assinatura vencida';
      const body =
        `Sua assinatura ${input.planName} venceu e há uma cobrança pendente de ${valor}. ` +
        'Abra o app para pagar por PIX e reativar seu plano.';
      const dedupeKey = `sub-overdue:${input.subscriptionId}:${input.cycleKey}`;

      // O índice UNIQUE é no dedupeKey inteiro → um sufixo por canal, senão o
      // claim do push bloquearia o do e-mail.
      if (await this.claimNotification(`${dedupeKey}:push`, 'SUB_OVERDUE', input.clientId, 'PUSH')) {
        await this.notifyClient(input.clientId, title, body).catch((e) =>
          this.logger.warn(`[sub-overdue] push falhou para ${input.clientId}: ${e}`),
        );
      }

      const { data: client } = await this.supabase
        .from('clients')
        .select('name, email')
        .eq('id', input.clientId)
        .maybeSingle();
      const email = (client as any)?.email;
      if (
        email &&
        (await this.claimNotification(`${dedupeKey}:email`, 'SUB_OVERDUE', input.clientId, 'EMAIL'))
      ) {
        const payUrl =
          (this.config.get<string>('CLIENT_APP_URL') || 'https://barbeariaamerica.com.br').replace(/\/+$/, '') +
          '/planos';
        await this.mail.sendSubscriptionOverdueEmail(
          email,
          (client as any)?.name || 'cliente',
          input.planName,
          valor,
          payUrl,
        );
      }
    } catch (e) {
      this.logger.error(`[sub-overdue] falha ao notificar ${input.clientId}: ${e}`);
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

  /** Envia notificação para todos os admins/profissionais */
  async notifyStaff(title: string, body: string, url = '/agendamentos') {
    const { data: subs } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('role', 'STAFF');

    if (!subs?.length) return;

    const payload = {
      title,
      body,
      icon: '/favicon/web-app-manifest-192x192.png',
      badge: '/favicon/favicon-96x96.png',
      data: { url },
    };

    for (const sub of subs) {
      await this.sendPush(sub, payload);
    }
  }

  /** Notifica staff quando um novo agendamento é criado pelo cliente */
  async notifyNewBooking(appointment: any) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    if (!publicKey) return;

    try {
      const clientName = appointment.client?.name || 'Cliente';
      const profName = appointment.professional?.name || 'profissional';
      const services = (appointment.services || [])
        .map((s: any) => s.service?.name)
        .filter(Boolean)
        .join(', ');
      const scheduledAt = new Date(appointment.scheduledAt);
      const time = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const date = scheduledAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      await this.notifyStaff(
        `Novo agendamento!`,
        `${clientName} agendou ${services} com ${profName} em ${date} as ${time}`,
      );
    } catch (err) {
      this.logger.error(`Failed to notify staff of new booking: ${err}`);
    }
  }
}
