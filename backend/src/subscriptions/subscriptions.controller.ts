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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeClientDto } from './dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

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
  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptionsService.createPlan(dto);
  }

  /**
   * PATCH /subscriptions/plans/:id
   * Updates a subscription plan (admin)
   */
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
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(@Body() dto: SubscribeClientDto) {
    return this.subscriptionsService.subscribe(dto);
  }

  /**
   * POST /subscriptions/:id/cancel
   * Cancels a subscription
   */
  @Post(':id/cancel')
  async cancelSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }

  /**
   * POST /subscriptions/:id/use-cut
   * Registers a cut usage from subscription
   */
  @Post(':id/use-cut')
  async useCut(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.useCut(id);
  }

  /**
   * POST /subscriptions/:id/reset-cuts
   * Resets cuts counter (after payment confirmed)
   */
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
  @Post(':id/force-charge')
  async forceCharge(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptionsService.forceCharge(id);
  }
}

