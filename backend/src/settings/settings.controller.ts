import { Controller, Get, Patch, Post, Delete, Body } from '@nestjs/common';
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

  /** Define ou altera o PIN de comissões */
  @Patch('commission-pin')
  @ApiBearerAuth('JWT-auth')
  async setCommissionPin(@Body() body: { pin: string }) {
    return this.settings.setCommissionPin(body.pin);
  }

  /** Remove o PIN de comissões */
  @Delete('commission-pin')
  @ApiBearerAuth('JWT-auth')
  async removeCommissionPin() {
    return this.settings.removeCommissionPin();
  }

  /** Verifica o PIN de comissões */
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
