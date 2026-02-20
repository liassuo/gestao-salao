import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

/**
 * Supabase module
 * Global module that provides SupabaseService to all modules
 * No need to import in other modules
 */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
