import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';
import {
  SendNotificationInput,
  RecipientTarget,
  NOTIFICATION_TYPE_CONFIG,
} from './notification.types';

@Injectable()
export class InAppNotificationsService {
  private readonly logger = new Logger(InAppNotificationsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Envia notificação (fire-and-forget).
   * NUNCA lança exceção — apenas loga erros.
   */
  async send(input: SendNotificationInput): Promise<void> {
    try {
      const {
        type,
        title,
        message,
        targets,
        actor_id,
        action_url,
        entity_type,
        entity_id,
        group_key,
        anti_spam = 'always',
        cooldown_minutes = 30,
        metadata = {},
      } = input;

      const priority =
        input.priority || NOTIFICATION_TYPE_CONFIG[type]?.defaultPriority || 'medium';

      // 1. Resolver destinatários
      const recipientIds = await this.resolveRecipients(targets);

      // 2. Remover o actor (não auto-notificar)
      const filtered = recipientIds.filter((id) => id !== actor_id);

      if (filtered.length === 0) return;

      // 3. Para cada destinatário, aplicar anti-spam e criar notificações
      const toInsert: any[] = [];

      for (const recipientId of filtered) {
        if (anti_spam === 'aggregate' && group_key) {
          const handled = await this.handleAggregate(
            recipientId,
            group_key,
            title,
            message,
            metadata,
          );
          if (handled) continue;
        }

        if (anti_spam === 'cooldown' && group_key) {
          const shouldSkip = await this.handleCooldown(
            recipientId,
            group_key,
            cooldown_minutes,
          );
          if (shouldSkip) continue;
        }

        toInsert.push({
          id: randomUUID(),
          recipient_id: recipientId,
          actor_id: actor_id || null,
          type,
          title,
          message,
          priority,
          action_url: action_url || null,
          entity_type: entity_type || null,
          entity_id: entity_id || null,
          group_key: group_key || null,
          metadata,
          read: false,
          archived: false,
          created_at: new Date().toISOString(),
        });
      }

      // 4. Batch insert em chunks de 100
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { error } = await this.supabase.from('notifications').insert(chunk);
        if (error) {
          this.logger.error(`Insert error: ${error.message}`);
        }
      }
    } catch (error) {
      // NUNCA joga erro — notificações são fire-and-forget
      this.logger.error(`[send] error: ${error}`);
    }
  }

  /**
   * Resolve targets em user_ids únicos
   */
  private async resolveRecipients(targets: RecipientTarget[]): Promise<string[]> {
    const userIds = new Set<string>();

    for (const target of targets) {
      switch (target.type) {
        case 'user':
          userIds.add(target.user_id);
          break;

        case 'role': {
          const { data: users } = await this.supabase
            .from('users')
            .select('id')
            .eq('role', target.role)
            .eq('isActive', true);
          if (users) {
            users.forEach((u: any) => userIds.add(u.id));
          }
          break;
        }

        case 'all': {
          const { data: users } = await this.supabase
            .from('users')
            .select('id')
            .eq('isActive', true);
          if (users) {
            users.forEach((u: any) => userIds.add(u.id));
          }
          break;
        }
      }
    }

    return Array.from(userIds);
  }

  /**
   * Anti-spam: aggregate — atualiza notificação existente não lida
   * Retorna true se atualizou (não precisa inserir nova)
   */
  private async handleAggregate(
    recipientId: string,
    groupKey: string,
    title: string,
    message: string,
    metadata: Record<string, any>,
  ): Promise<boolean> {
    const { data: existing } = await this.supabase
      .from('notifications')
      .select('id, metadata')
      .eq('recipient_id', recipientId)
      .eq('group_key', groupKey)
      .eq('read', false)
      .limit(1)
      .single();

    if (existing) {
      const count = ((existing.metadata as any)?.aggregate_count || 1) + 1;
      await this.supabase
        .from('notifications')
        .update({
          title,
          message,
          metadata: { ...metadata, aggregate_count: count },
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return true;
    }

    return false;
  }

  /**
   * Anti-spam: cooldown — ignora se já existe notificação recente
   * Retorna true se deve ignorar
   */
  private async handleCooldown(
    recipientId: string,
    groupKey: string,
    cooldownMinutes: number,
  ): Promise<boolean> {
    const since = new Date(
      Date.now() - cooldownMinutes * 60 * 1000,
    ).toISOString();

    const { data: existing } = await this.supabase
      .from('notifications')
      .select('id')
      .eq('recipient_id', recipientId)
      .eq('group_key', groupKey)
      .gte('created_at', since)
      .limit(1);

    return !!(existing && existing.length > 0);
  }

  // =================== CRUD ===================

  /**
   * Lista notificações do usuário (paginada)
   */
  async getByUser(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      filter?: 'all' | 'unread' | 'read';
      type?: string;
    } = {},
  ) {
    const { page = 1, limit = 20, filter = 'all', type } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('notifications')
      .select('*, actor:users!notifications_actor_id_fkey(id, name)', { count: 'exact' })
      .eq('recipient_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter === 'unread') query = query.eq('read', false);
    if (filter === 'read') query = query.eq('read', true);
    if (type) query = query.eq('type', type);

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Conta notificações não lidas
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false)
      .eq('archived', false);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Marca notificações como lidas
   */
  async markAsRead(userId: string, ids: string[]) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .in('id', ids);

    if (error) throw error;
  }

  /**
   * Marca todas como lidas
   */
  async markAllAsRead(userId: string) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (error) throw error;
  }

  /**
   * Arquiva notificações
   */
  async archive(userId: string, ids: string[]) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ archived: true })
      .eq('recipient_id', userId)
      .in('id', ids);

    if (error) throw error;
  }

  /**
   * Deleta notificações
   */
  async deleteNotifications(userId: string, ids: string[]) {
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', userId)
      .in('id', ids);

    if (error) throw error;
  }
}
