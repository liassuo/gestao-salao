import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('isTemplate') isTemplate?: string,
  ) {
    return this.promotionsService.findAll({
      status,
      isTemplate: isTemplate !== undefined ? isTemplate === 'true' : undefined,
    });
  }

  @Get('active')
  async findActive() {
    return this.promotionsService.findActive();
  }

  @Get('templates')
  async findTemplates() {
    return this.promotionsService.findTemplates();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(dto);
  }

  @Post('clone/:templateId')
  @HttpCode(HttpStatus.CREATED)
  async cloneFromTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() overrides: Partial<CreatePromotionDto>,
  ) {
    return this.promotionsService.cloneFromTemplate(templateId, overrides);
  }

  @Post('upload-banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(@UploadedFile() file: Express.Multer.File) {
    return this.promotionsService.uploadBanner(file);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.promotionsService.remove(id);
  }
}
