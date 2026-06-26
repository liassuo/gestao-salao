import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ClientsService, ClientFilters } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';

interface ClientQueryFilters {
  search?: string;
  hasDebts?: string;
  isActive?: string;
}
interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Clients')
@ApiBearerAuth()
// Lista/cadastro/exclusão de clientes = ADMIN. EXCEÇÃO: GET/PATCH /:id liberam CLIENT
// SÓ para o próprio id (app do cliente edita o próprio perfil) — checado no método.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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
  // ADMIN vê qualquer cliente; CLIENT só o PRÓPRIO (id == req.user.id).
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    if (req.user.role === UserRole.CLIENT && req.user.id !== id) {
      throw new ForbiddenException('Você só pode acessar o seu próprio cadastro');
    }
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
  // ADMIN edita qualquer cliente; CLIENT só o PRÓPRIO cadastro.
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.role === UserRole.CLIENT && req.user.id !== id) {
      throw new ForbiddenException('Você só pode editar o seu próprio cadastro');
    }
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
