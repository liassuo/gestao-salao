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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { PaymentMethodConfigService } from './payment-method-config.service';
import {
  CreatePaymentMethodConfigDto,
  UpdatePaymentMethodConfigDto,
  QueryPaymentMethodConfigDto,
} from './dto';

@ApiTags('PaymentMethodConfig')
@ApiBearerAuth()
// Configuração de formas de pagamento = config do salão → só ADMIN.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('payment-method-config')
export class PaymentMethodConfigController {
  constructor(
    private readonly paymentMethodConfigService: PaymentMethodConfigService,
  ) {}

  /**
   * POST /payment-method-config
   * Cria uma nova configuracao de forma de pagamento
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePaymentMethodConfigDto) {
    return this.paymentMethodConfigService.create(dto);
  }

  /**
   * GET /payment-method-config
   * Lista todas as formas de pagamento com filtros opcionais (scope, type, isActive)
   */
  @Get()
  async findAll(@Query() query: QueryPaymentMethodConfigDto) {
    return this.paymentMethodConfigService.findAll(query);
  }

  /**
   * GET /payment-method-config/:id
   * Busca uma forma de pagamento por ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentMethodConfigService.findOne(id);
  }

  /**
   * PATCH /payment-method-config/:id
   * Atualiza uma forma de pagamento
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentMethodConfigDto,
  ) {
    return this.paymentMethodConfigService.update(id, dto);
  }

  /**
   * DELETE /payment-method-config/:id
   * Remove (soft delete) uma forma de pagamento
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.paymentMethodConfigService.remove(id);
  }
}
