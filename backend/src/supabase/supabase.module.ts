import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

<<<<<<< HEAD
/**
 * Supabase module
 * Global module that provides SupabaseService to all modules
 * No need to import in other modules
 */
=======
>>>>>>> f381e3e55327b86d6b7ce9aa46ca9065785ced95
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
