import { Controller, Get, Patch, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Busca configurações (admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiBearerAuth('JWT-auth')
  async get() {
    return this.settings.get();
  }

  /** Atualiza configurações (admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch()
  @ApiBearerAuth('JWT-auth')
  async update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  /** Define ou altera o PIN de comissões (admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('commission-pin')
  @ApiBearerAuth('JWT-auth')
  async setCommissionPin(@Body() body: { pin: string }) {
    return this.settings.setCommissionPin(body.pin);
  }

  /** Remove o PIN de comissões (admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('commission-pin')
  @ApiBearerAuth('JWT-auth')
  async removeCommissionPin() {
    return this.settings.removeCommissionPin();
  }

  /** Verifica o PIN de comissões (admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('verify-commission-pin')
  @ApiBearerAuth('JWT-auth')
  async verifyCommissionPin(@Body() body: { pin: string }) {
    return this.settings.verifyCommissionPin(body.pin);
  }

  /** Retorna WhatsApp da barbearia (público, para app do cliente) */
  @Public()
  @Get('whatsapp')
  async getWhatsapp() {
    const whatsapp = await this.settings.getWhatsapp();
    return { whatsapp };
  }
}
