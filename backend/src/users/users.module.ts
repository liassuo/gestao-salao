import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Users module
 * Manages system users (ADMIN and PROFESSIONAL roles)
 * Handles authentication and authorization
 */
@Module({
  providers: [UsersService],
  exports: [UsersService], // Export for use in other modules (e.g., auth)
})
export class UsersModule {}
