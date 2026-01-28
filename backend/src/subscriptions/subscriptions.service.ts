import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeClientDto } from './dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================

  /**
   * Create a new subscription plan
   */
  async createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        cutsPerMonth: dto.cutsPerMonth,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        cutsPerMonth: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Find all subscription plans
   */
  async findAllPlans(activeOnly: boolean = true) {
    const where = activeOnly ? { isActive: true } : {};

    return this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        cutsPerMonth: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            subscriptions: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });
  }

  /**
   * Find a subscription plan by ID
   */
  async findPlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        cutsPerMonth: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return plan;
  }

  /**
   * Update a subscription plan
   */
  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        cutsPerMonth: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Soft delete a subscription plan
   */
  async removePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    // Check if there are active subscriptions
    const activeSubscriptions = await this.prisma.clientSubscription.count({
      where: {
        planId: id,
        status: 'ACTIVE',
      },
    });

    if (activeSubscriptions > 0) {
      throw new BadRequestException(
        `Não é possível desativar este plano. Existem ${activeSubscriptions} assinatura(s) ativa(s).`,
      );
    }

    await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ============================================
  // CLIENT SUBSCRIPTIONS
  // ============================================

  /**
   * Subscribe a client to a plan
   */
  async subscribe(dto: SubscribeClientDto) {
    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // Verify plan exists and is active
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plano não encontrado ou inativo');
    }

    // Check if client already has an active subscription
    const existingSubscription = await this.prisma.clientSubscription.findUnique(
      {
        where: { clientId: dto.clientId },
      },
    );

    if (existingSubscription) {
      if (existingSubscription.status === 'ACTIVE') {
        throw new BadRequestException(
          'Cliente já possui uma assinatura ativa. Cancele a atual antes de criar uma nova.',
        );
      }

      // If subscription exists but is not active, delete it
      await this.prisma.clientSubscription.delete({
        where: { id: existingSubscription.id },
      });
    }

    // Create new subscription
    return this.prisma.clientSubscription.create({
      data: {
        clientId: dto.clientId,
        planId: dto.planId,
        status: 'ACTIVE',
        startDate: new Date(),
        cutsUsedThisMonth: 0,
        lastResetDate: new Date(),
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        cutsUsedThisMonth: true,
        lastResetDate: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            cutsPerMonth: true,
          },
        },
      },
    });
  }

  /**
   * Find all client subscriptions
   */
  async findAllSubscriptions(status?: string) {
    const where = status ? { status: status as any } : {};

    return this.prisma.clientSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        cutsUsedThisMonth: true,
        lastResetDate: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            cutsPerMonth: true,
          },
        },
      },
    });
  }

  /**
   * Find a subscription by ID
   */
  async findSubscription(id: string) {
    const subscription = await this.prisma.clientSubscription.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        cutsUsedThisMonth: true,
        lastResetDate: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            cutsPerMonth: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    return subscription;
  }

  /**
   * Find subscription by client ID
   */
  async findByClient(clientId: string) {
    const subscription = await this.prisma.clientSubscription.findUnique({
      where: { clientId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        cutsUsedThisMonth: true,
        lastResetDate: true,
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            cutsPerMonth: true,
          },
        },
      },
    });

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(id: string) {
    const subscription = await this.prisma.clientSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Assinatura não está ativa');
    }

    return this.prisma.clientSubscription.update({
      where: { id },
      data: {
        status: 'CANCELED',
        endDate: new Date(),
      },
      select: {
        id: true,
        status: true,
        endDate: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Use a cut from subscription
   */
  async useCut(id: string) {
    const subscription = await this.prisma.clientSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Assinatura não está ativa');
    }

    // Check if needs to reset monthly cuts
    const now = new Date();
    const lastReset = new Date(subscription.lastResetDate);
    const needsReset =
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear();

    let cutsUsed = subscription.cutsUsedThisMonth;

    if (needsReset) {
      cutsUsed = 0;
    }

    // Check if has cuts available
    if (cutsUsed >= subscription.plan.cutsPerMonth) {
      throw new BadRequestException(
        `Limite de cortes atingido (${subscription.plan.cutsPerMonth}/${subscription.plan.cutsPerMonth})`,
      );
    }

    // Increment cuts used
    return this.prisma.clientSubscription.update({
      where: { id },
      data: {
        cutsUsedThisMonth: cutsUsed + 1,
        lastResetDate: needsReset ? now : subscription.lastResetDate,
      },
      select: {
        id: true,
        cutsUsedThisMonth: true,
        lastResetDate: true,
        plan: {
          select: {
            cutsPerMonth: true,
          },
        },
      },
    });
  }

  /**
   * Get remaining cuts for a subscription
   */
  async getRemainingCuts(id: string) {
    const subscription = await this.prisma.clientSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    // Check if needs to reset monthly cuts
    const now = new Date();
    const lastReset = new Date(subscription.lastResetDate);
    const needsReset =
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear();

    const cutsUsed = needsReset ? 0 : subscription.cutsUsedThisMonth;
    const remaining = subscription.plan.cutsPerMonth - cutsUsed;

    return {
      cutsUsed,
      cutsPerMonth: subscription.plan.cutsPerMonth,
      remaining,
      needsReset,
    };
  }

  /**
   * Reset monthly cuts for all active subscriptions (for cron job)
   */
  async resetAllMonthlyCuts() {
    const now = new Date();

    return this.prisma.clientSubscription.updateMany({
      where: {
        status: 'ACTIVE',
      },
      data: {
        cutsUsedThisMonth: 0,
        lastResetDate: now,
      },
    });
  }
}
