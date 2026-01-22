import { Module } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Professionals module
 * Manages barbers who provide services
 * Handles schedule, availability, and service assignments
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
})
export class ProfessionalsModule {}
