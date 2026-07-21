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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CommissionsService } from './commissions.service';
import { GenerateCommissionDto, QueryCommissionDto } from './dto';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Commissions')
@ApiBearerAuth()
// Tudo aqui é financeiro do salão → só ADMIN. Exceção: GET /commissions/me
// (barbeiro vê a PRÓPRIA comissão), que sobrescreve com @Roles abaixo.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  /**
   * GET /commissions/me — comissão do PRÓPRIO profissional logado no período.
   * Força professionalId = req.user.professionalId (ignora qualquer id na query),
   * então o barbeiro nunca vê a comissão de outro.
   */
  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.PROFESSIONAL)
  async findMine(@Req() req: RequestWithUser, @Query() query: QueryCommissionDto) {
    const professionalId = req.user.professionalId;
    if (!professionalId) return [];
    // Força o professionalId do TOKEN — ignora qualquer id vindo na query, então
    // o barbeiro nunca consegue ver a comissão de outro.
    return this.commissionsService.findAll({ ...query, professionalId });
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() generateCommissionDto: GenerateCommissionDto) {
    return this.commissionsService.generate(generateCommissionDto);
  }

  @Get('pote-report')
  async getPoteReport(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('revenueOverride') revenueOverride?: string,
  ) {
    const override =
      revenueOverride !== undefined && revenueOverride !== ''
        ? Number(revenueOverride)
        : undefined;
    return this.commissionsService.getPoteReport(
      periodStart,
      periodEnd,
      Number.isFinite(override as number) ? override : undefined,
    );
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

  /**
   * Desfaz a marcação de pago (PAID → PENDING). Pré-requisito para excluir ou
   * regerar um período que contenha comissão paga — excluir comissão paga é
   * bloqueado no service.
   */
  @Patch(':id/unpay')
  async unmarkAsPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissionsService.unmarkAsPaid(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.commissionsService.remove(id);
  }
}
