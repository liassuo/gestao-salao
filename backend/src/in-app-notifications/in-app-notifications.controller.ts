import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InAppNotificationsService } from './in-app-notifications.service';
import { QueryNotificationsDto, NotificationIdsDto } from './dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('In-App Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('in-app-notifications')
export class InAppNotificationsController {
  constructor(
    private readonly inAppNotificationsService: InAppNotificationsService,
  ) {}

  /**
   * GET /in-app-notifications
   * Lista notificações do usuário (paginada)
   */
  @Get()
  async list(
    @Req() req: RequestWithUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.inAppNotificationsService.getByUser(req.user.id, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      filter: query.filter || 'all',
      type: query.type,
    });
  }

  /**
   * GET /in-app-notifications/unread-count
   * Retorna contagem de não lidas
   */
  @Get('unread-count')
  async unreadCount(@Req() req: RequestWithUser) {
    const count = await this.inAppNotificationsService.getUnreadCount(
      req.user.id,
    );
    return { count };
  }

  /**
   * PATCH /in-app-notifications/read
   * Marca notificações específicas como lidas
   */
  @Patch('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Req() req: RequestWithUser,
    @Body() dto: NotificationIdsDto,
  ) {
    await this.inAppNotificationsService.markAsRead(req.user.id, dto.ids);
  }

  /**
   * PATCH /in-app-notifications/read-all
   * Marca todas como lidas
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@Req() req: RequestWithUser) {
    await this.inAppNotificationsService.markAllAsRead(req.user.id);
  }

  /**
   * PATCH /in-app-notifications/archive
   * Arquiva notificações específicas
   */
  @Patch('archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Req() req: RequestWithUser,
    @Body() dto: NotificationIdsDto,
  ) {
    await this.inAppNotificationsService.archive(req.user.id, dto.ids);
  }

  /**
   * POST /in-app-notifications/delete
   * Deleta notificações (POST porque DELETE não aceita body)
   */
  @Post('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotifications(
    @Req() req: RequestWithUser,
    @Body() dto: NotificationIdsDto,
  ) {
    await this.inAppNotificationsService.deleteNotifications(
      req.user.id,
      dto.ids,
    );
  }
}
