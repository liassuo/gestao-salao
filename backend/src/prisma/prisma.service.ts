import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma service
 * Manages database connection lifecycle
 * Provides PrismaClient instance to other services
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Connect to database when module initializes
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Disconnect from database when module destroys
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
