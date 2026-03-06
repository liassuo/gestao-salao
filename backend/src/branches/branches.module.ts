import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
/**
 * Branches module
 * Manages salon branches (filiais)
 * Handles branch CRUD and active/inactive status
 */
@Module({
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
