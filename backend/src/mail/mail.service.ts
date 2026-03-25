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
}
