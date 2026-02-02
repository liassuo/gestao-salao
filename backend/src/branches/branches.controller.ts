import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /**
   * POST /branches
   * Creates a new branch (admin)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  /**
   * GET /branches
   * Returns all branches
   */
  @Get()
  async findAll() {
    return this.branchesService.findAll();
  }

  /**
   * GET /branches/active
   * Returns only active branches
   */
  @Get('active')
  async findActive() {
    return this.branchesService.findActive();
  }

  /**
   * GET /branches/:id
   * Returns a specific branch
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.findOne(id);
  }

  /**
   * PATCH /branches/:id
   * Updates a branch (admin)
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, dto);
  }

  /**
   * DELETE /branches/:id
   * Soft deletes a branch
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.branchesService.remove(id);
  }
}
