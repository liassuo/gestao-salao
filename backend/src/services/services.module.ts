import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';

/**
 * Services module
 * Manages services offered by the barbershop
 * Handles service catalog, pricing, and availability
 */
@Module({
  providers: [ServicesService],
  exports: [ServicesService], // Export for use in appointments and professionals modules
})
export class ServicesModule {}
