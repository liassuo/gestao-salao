import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetUrl: string,
  ): Promise<void> {
    const from = `"${this.config.get('SMTP_FROM_NAME', 'Barbearia América')}" <${this.config.get('SMTP_FROM_EMAIL')}>`;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Recuperação de Senha</title>
</head>
<body style="margin:0;padding:0;background:#1A1008;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1008;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#1E1610;border:1px solid #3D2B1F;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#8B2020,#A63030);padding:32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:bold;color:#F2E8D5;letter-spacing:2px;text-transform:uppercase;">
                Barbearia América
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#D4C4A0;">Olá, <strong>${name}</strong></p>
              <p style="margin:0 0 24px;font-size:14px;color:#8B7D6B;line-height:1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. O link é válido por <strong style="color:#C8923A;">1 hora</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#8B2020,#A63030);border-radius:10px;padding:14px 32px;">
                    <a href="${resetUrl}" style="color:#F2E8D5;text-decoration:none;font-size:15px;font-weight:bold;">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#6B5D4F;line-height:1.6;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin:0;font-size:12px;color:#C8923A;word-break:break-all;">${resetUrl}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #3D2B1F;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6B5D4F;">
                Se você não solicitou a redefinição de senha, ignore este email — sua senha permanece a mesma.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'Redefinição de Senha — Barbearia América',
        html,
      });
      this.logger.log(`Email de redefinição enviado para ${to}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar email para ${to}: ${err.message}`);
      throw err;
    }
  }

  private get fromAddress(): string {
    return `"${this.config.get('SMTP_FROM_NAME', 'Barbearia América')}" <${this.config.get('SMTP_FROM_EMAIL')}>`;
  }

  /**
   * Template visual padrão da barbearia (mesmo estilo do e-mail de senha). Recebe
   * um título, o corpo (HTML) e um CTA opcional. Centraliza o layout pros e-mails
   * transacionais (lembrete de agendamento, aviso de vencimento).
   */
  private renderTemplate(opts: {
    heading: string;
    bodyHtml: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): string {
    const cta =
      opts.ctaLabel && opts.ctaUrl
        ? `<table cellpadding="0" cellspacing="0" style="margin:8px auto 24px;">
             <tr><td style="background:linear-gradient(135deg,#8B6914,#C8923A);border-radius:10px;padding:14px 32px;">
               <a href="${opts.ctaUrl}" style="color:#1A1008;text-decoration:none;font-size:15px;font-weight:bold;">${opts.ctaLabel}</a>
             </td></tr>
           </table>`
        : '';
    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#1A1008;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1008;padding:40px 0;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#1E1610;border:1px solid #3D2B1F;border-radius:16px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#8B2020,#A63030);padding:32px;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#F2E8D5;letter-spacing:2px;text-transform:uppercase;">Barbearia América</p>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#C8923A;">${opts.heading}</p>
        <div style="font-size:14px;color:#D4C4A0;line-height:1.6;">${opts.bodyHtml}</div>
        ${cta}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #3D2B1F;text-align:center;">
        <p style="margin:0;font-size:12px;color:#6B5D4F;">Barbearia América — agende pelo app: barbeariaamerica.com.br</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  }

  /**
   * Aviso de assinatura próxima do vencimento. `daysLeft=0` = vence hoje.
   * Não lança exceção: erro de envio é logado (não trava o cron de notificações).
   */
  async sendSubscriptionExpiringEmail(
    to: string,
    name: string,
    planName: string,
    daysLeft: number,
    renewUrl: string,
  ): Promise<void> {
    const quando =
      daysLeft <= 0
        ? 'vence <strong>hoje</strong>'
        : daysLeft === 1
        ? 'vence <strong>amanhã</strong>'
        : `vence em <strong>${daysLeft} dias</strong>`;
    const html = this.renderTemplate({
      heading: 'Sua assinatura está vencendo',
      bodyHtml: `<p>Olá, <strong>${name}</strong>!</p>
        <p>Sua assinatura <strong>${planName}</strong> ${quando}. Para não perder o acesso aos seus cortes, é só renovar pelo app.</p>`,
      ctaLabel: 'Renovar assinatura',
      ctaUrl: renewUrl,
    });
    try {
      await this.transporter.sendMail({ from: this.fromAddress, to, subject: 'Sua assinatura está vencendo — Barbearia América', html });
      this.logger.log(`Aviso de vencimento enviado para ${to} (${daysLeft}d)`);
    } catch (err) {
      this.logger.error(`Falha ao enviar aviso de vencimento para ${to}: ${err.message}`);
    }
  }

  /**
   * Aviso de assinatura VENCIDA sem pagamento (dívida criada). Não lança exceção.
   */
  async sendSubscriptionOverdueEmail(
    to: string,
    name: string,
    planName: string,
    amountFormatted: string,
    payUrl: string,
  ): Promise<void> {
    const html = this.renderTemplate({
      heading: 'Sua assinatura venceu',
      bodyHtml: `<p>Olá, <strong>${name}</strong>!</p>
        <p>Sua assinatura <strong>${planName}</strong> venceu e há uma cobrança pendente de <strong>${amountFormatted}</strong>.</p>
        <p>Para continuar usando seus cortes, é só pagar pelo app — leva menos de um minuto no PIX.</p>`,
      ctaLabel: 'Pagar e reativar',
      ctaUrl: payUrl,
    });
    try {
      await this.transporter.sendMail({ from: this.fromAddress, to, subject: 'Sua assinatura venceu — Barbearia América', html });
      this.logger.log(`Aviso de inadimplência enviado para ${to}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar aviso de inadimplência para ${to}: ${err.message}`);
    }
  }

  /**
   * Lembrete de horário agendado (enviado na manhã do dia). Não lança exceção.
   */
  async sendAppointmentReminderEmail(
    to: string,
    name: string,
    time: string,
    professional: string,
    services: string,
  ): Promise<void> {
    const html = this.renderTemplate({
      heading: 'Você tem horário hoje',
      bodyHtml: `<p>Olá, <strong>${name}</strong>!</p>
        <p>Passando pra lembrar do seu horário <strong>hoje às ${time}</strong>${professional ? ` com <strong>${professional}</strong>` : ''}${services ? ` (${services})` : ''}.</p>
        <p>Te esperamos!</p>`,
    });
    try {
      await this.transporter.sendMail({ from: this.fromAddress, to, subject: 'Lembrete do seu horário hoje — Barbearia América', html });
      this.logger.log(`Lembrete de agendamento enviado para ${to}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar lembrete de agendamento para ${to}: ${err.message}`);
    }
  }
}
