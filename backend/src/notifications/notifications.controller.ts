import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** Retorna a VAPID public key pro frontend se inscrever */
  @Public()
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return {
      publicKey: this.config.get<string>('VAPID_PUBLIC_KEY', ''),
    };
  }

  /** Salva a push subscription de um cliente autenticado */
  @Post('subscribe')
  @ApiBearerAuth('JWT-auth')
  async subscribe(@Req() req: any, @Body() body: any) {
    const role = req.user.role === 'CLIENT' ? 'CLIENT' : 'STAFF';
    await this.notifications.saveSubscription(req.user.sub, body, role);
    return { message: 'Subscription saved' };
  }

  /** Remove uma push subscription */
  @Delete('unsubscribe')
  @ApiBearerAuth('JWT-auth')
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.notifications.removeSubscription(body.endpoint);
    return { message: 'Subscription removed' };
  }
}
