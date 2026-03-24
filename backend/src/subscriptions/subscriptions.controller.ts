import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeClientDto } from './dto';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ============================================
  // CLIENT-FACING ENDPOINTS (JWT auth)
  // ============================================

  /**
   * GET /subscriptions/me
   * Retorna assinatura ativa do cliente autenticado
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMySubscription(@Req() req: RequestWithUser) {
    return this.subscriptionsService.getMySubscription(req.user.id);
  }

  /**
   * POST /subscriptions/me/subscribe
   * Assina um plano (cliente autenticado)
   */
  @UseGuards(JwtAuthGuard)
  @Post('me/subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribeMe(
    @Req() req: RequestWithUser,
    @Body() body: { planId: string },
  ) {
    return this.subscriptionsService.subscribeByClientId(req.user.id, body.planId);
  }

  /**
   * POST /subscriptions/me/cancel
   * Cancela assinatura ativa do cliente autenticado
   */
  @UseGuards(JwtAuthGuard)
  @Post('me/cancel')
  async cancelMySubscription(@Req() req: RequestWithUser) {
    return this.subscriptionsService.cancelMySubscription(req.user.id);
  }

  /**
   * POST /subscriptions/me/reactivate
   * Reativa assinatura suspensa do cliente autenticado, gerando nova cobrança PIX
   */
  @UseGuards(JwtAuthGuard)
  @Post('me/reactivate')
  async reactivateMySubscription(@Req() req: RequestWithUser) {
    return this.subscriptionsService.reactivateMySubscription(req.user.id);
  }

  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================

  /**
   * GET /subscriptions/plans
   * Returns all subscription plans
   */
  @Get('plans')
  async findAllPlans(@Query('all') all?: string) {
    const activeOnly = all !== 'true';
    return this.subscriptionsService.findAllPlans(activeOnly);
  }

  /**
   * GET /subscriptions/plans/:id
   * Returns a specific subscription plan
   */
  @Get('plans/:id')
  async findPlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.findPlan(id);
  }

  /**
   * POST /subscriptions/plans
   * Creates a new subscription plan (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptionsService.createPlan(dto);
  }

  /**
   * PATCH /subscriptions/plans/:id
   * Updates a subscription plan (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('plans/:id')
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.subscriptionsService.updatePlan(id, dto);
  }

  /**
   * DELETE /subscriptions/plans/:id
   * Soft deletes a subscription plan (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePlan(@Param('id', ParseUUIDPipe) id: string) {
    await this.subscriptionsService.removePlan(id);
  }

  // ============================================
  // CLIENT SUBSCRIPTIONS
  // ============================================

  /**
   * GET /subscriptions
   * Returns all client subscriptions
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  async findAllSubscriptions(@Query('status') status?: string) {
    return this.subscriptionsService.findAllSubscriptions(status);
  }

  /**
   * GET /subscriptions/:id
   * Returns a specific subscription
   */
  @Get(':id')
  async findSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.findSubscription(id);
  }

  /**
   * GET /subscriptions/client/:clientId
   * Returns subscription for a specific client
   */
  @Get('client/:clientId')
  async findByClient(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.subscriptionsService.findByClient(clientId);
  }

  /**
   * POST /subscriptions/subscribe
   * Subscribes a client to a plan (admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(@Body() dto: SubscribeClientDto) {
    return this.subscriptionsService.subscribe(dto);
  }

  /**
   * POST /subscriptions/:id/cancel
   * Cancels a subscription
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/cancel')
  async cancelSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }

  /**
   * POST /subscriptions/:id/use-cut
   * Registers a cut usage from subscription
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/use-cut')
  async useCut(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.useCut(id);
  }

  /**
   * POST /subscriptions/:id/reset-cuts
   * Resets cuts counter (after payment confirmed)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/reset-cuts')
  async resetCuts(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.resetCuts(id);
  }

  /**
   * GET /subscriptions/:id/remaining-cuts
   * Gets remaining cuts for a subscription
   */
  @Get(':id/remaining-cuts')
  async getRemainingCuts(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.getRemainingCuts(id);
  }

  /**
   * POST /subscriptions/:id/force-charge
   * Força uma nova cobrança manual para a assinatura (Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/force-charge')
  async forceCharge(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.forceCharge(id);
  }
}

