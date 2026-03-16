import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Busca configurações (admin autenticado) */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async get() {
    return this.settings.get();
  }

  /** Atualiza configurações (admin autenticado) */
  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  /** Retorna WhatsApp da barbearia (público, para app do cliente) */
  @Get('whatsapp')
  async getWhatsapp() {
    const whatsapp = await this.settings.getWhatsapp();
    return { whatsapp };
  }
}
