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
import { CommissionsService } from './commissions.service';
import { GenerateCommissionDto, QueryCommissionDto } from './dto';

@ApiTags('Commissions')
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() generateCommissionDto: GenerateCommissionDto) {
    return this.commissionsService.generate(generateCommissionDto);
  }

  @Get()
  async findAll(@Query() query: QueryCommissionDto) {
    return this.commissionsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissionsService.findOne(id);
  }

  @Patch(':id/pay')
  async markAsPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissionsService.markAsPaid(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.commissionsService.remove(id);
  }
}
