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
import { ProfessionalDebtsService } from './professional-debts.service';
import {
  CreateProfessionalDebtDto,
  QueryProfessionalDebtDto,
  SettleCashDto,
} from './dto';

@ApiTags('Professional Debts')
@Controller('professional-debts')
export class ProfessionalDebtsController {
  constructor(private readonly service: ProfessionalDebtsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProfessionalDebtDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryProfessionalDebtDto) {
    return this.service.findAll(query);
  }

  @Get('professional/:id/summary')
  getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getProfessionalSummary(id);
  }

  @Get('professional/:id/pending')
  getPending(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPendingByProfessional(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/settle-cash')
  settleCash(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleCashDto,
  ) {
    return this.service.settleCash(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}
