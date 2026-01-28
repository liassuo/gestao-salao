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

interface ClientQueryFilters {
  search?: string;
  hasDebts?: string;
  isActive?: string;
}

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

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
    return this.clientsService.create(dto);
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
}
