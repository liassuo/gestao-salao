import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinancialCategoriesService } from './financial-categories.service';
import {
  CreateFinancialCategoryDto,
  UpdateFinancialCategoryDto,
  QueryFinancialCategoryDto,
} from './dto';

@ApiTags('FinancialCategories')
@Controller('financial-categories')
export class FinancialCategoriesController {
  constructor(
    private readonly financialCategoriesService: FinancialCategoriesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createFinancialCategoryDto: CreateFinancialCategoryDto) {
    return this.financialCategoriesService.create(createFinancialCategoryDto);
  }

  @Get()
  async findAll(@Query() query: QueryFinancialCategoryDto) {
    return this.financialCategoriesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialCategoriesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFinancialCategoryDto: UpdateFinancialCategoryDto,
  ) {
    return this.financialCategoriesService.update(
      id,
      updateFinancialCategoryDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.financialCategoriesService.remove(id);
  }
}
