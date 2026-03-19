import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Busca configurações (admin autenticado) */
  @Get()
  @ApiBearerAuth('JWT-auth')
  async get() {
    return this.settings.get();
  }

  /** Atualiza configurações (admin autenticado) */
  @Patch()
  @ApiBearerAuth('JWT-auth')
  async update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  /** Retorna WhatsApp da barbearia (público, para app do cliente) */
  @Public()
  @Get('whatsapp')
  async getWhatsapp() {
    const whatsapp = await this.settings.getWhatsapp();
    return { whatsapp };
  }
}
