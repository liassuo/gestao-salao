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
import { ApiTags } from '@nestjs/swagger';
import { PaymentMethodConfigService } from './payment-method-config.service';
import {
  CreatePaymentMethodConfigDto,
  UpdatePaymentMethodConfigDto,
  QueryPaymentMethodConfigDto,
} from './dto';

@ApiTags('PaymentMethodConfig')
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
