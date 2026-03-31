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
import { ClientsService, ClientFilters } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';

interface ClientQueryFilters {
  search?: string;
  hasDebts?: string;
  isActive?: string;
}

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly inAppNotificationsService: InAppNotificationsService,
  ) {}

  /**
   * GET /clients
   * Returns all clients with optional filters
   */
  @Get()
  async findAll(@Query() query: ClientQueryFilters) {
    const filters: ClientFilters = {
      search: query.search,
      hasDebts: query.hasDebts !== undefined ? query.hasDebts === 'true' : undefined,
      isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
    };

    return this.clientsService.findAll(filters);
  }

  /**
   * GET /clients/with-debts
   * Returns clients with active debts
   */
  @Get('with-debts')
  async findClientsWithDebts() {
    return this.clientsService.findClientsWithDebts();
  }

  /**
   * GET /clients/:id
   * Returns a specific client with details
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }

  /**
   * POST /clients
   * Creates a new client
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateClientDto) {
    const client = await this.clientsService.create(dto);

    // Notificar admins sobre novo cliente (fire-and-forget)
    this.inAppNotificationsService.send({
      type: 'client_registered',
      title: 'Novo cliente cadastrado',
      message: `${dto.name} foi cadastrado no sistema`,
      targets: [{ type: 'role', role: 'ADMIN' }],
      action_url: '/clientes',
      entity_type: 'client',
      entity_id: client?.id,
      group_key: 'client_registered',
      anti_spam: 'aggregate',
    }).catch(() => {});

    return client;
  }

  /**
   * PATCH /clients/:id
   * Updates a client
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, dto);
  }

  /**
   * DELETE /clients/:id
   * Soft deletes a client
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.clientsService.remove(id);
  }

  /**
   * DELETE /clients/:id/permanent
   * Permanently deletes a client
   */
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    await this.clientsService.hardDelete(id);
  }
}
