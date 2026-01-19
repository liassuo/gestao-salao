import { Module } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';

/**
 * Professionals module
 * Manages barbers who provide services
 * Handles schedule, availability, and service assignments
 */
@Module({
  providers: [ProfessionalsService],
  exports: [ProfessionalsService], // Export for use in appointments module
})
export class ProfessionalsModule {}
