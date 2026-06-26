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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { ProfessionalDebtsService } from './professional-debts.service';
import {
  CreateProfessionalDebtDto,
  QueryProfessionalDebtDto,
  SettleCashDto,
} from './dto';

@ApiTags('Professional Debts')
@ApiBearerAuth()
// Débitos dos profissionais = financeiro interno → só ADMIN (barbeiro não vê débito de outro).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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
