import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
/**
 * Services module
 * Manages services offered by the barbershop
 * Handles service catalog, pricing, and availability
 */
@Module({
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
