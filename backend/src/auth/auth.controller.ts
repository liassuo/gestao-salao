import { Controller, Post, Patch, Body, Param, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, AuthResponseDto, GoogleAuthDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Alterar senha do usuário autenticado' })
  async changePassword(
    @Req() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    await this.authService.changePassword(req.user.sub, body.currentPassword, body.newPassword);
    return { message: 'Senha alterada com sucesso' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login de usuário administrativo' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('client/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastro de cliente com email/senha' })
  async clientRegister(
    @Body() body: { name: string; email: string; password: string; phone?: string },
  ): Promise<AuthResponseDto> {
    return this.authService.clientRegister(body);
  }

  @Post('client/check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar status do email do cliente' })
  async checkClientEmail(@Body() body: { email: string }) {
    return this.authService.checkClientEmail(body.email);
  }

  @Post('client/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login de cliente com email/senha' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async clientLogin(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.clientLogin(loginDto);
  }

  @Post('client/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login de cliente com Google OAuth' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async clientGoogleLogin(
    @Body() googleAuthDto: GoogleAuthDto,
  ): Promise<AuthResponseDto> {
    return this.authService.clientGoogleLogin(googleAuthDto);
  }

  @Post('client/setup-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Criar senha no primeiro acesso do cliente' })
  async clientSetupPassword(
    @Req() req: any,
    @Body() body: { password: string },
  ): Promise<AuthResponseDto> {
    return this.authService.clientSetupPassword(req.user.sub, body.password);
  }

  @Post('setup-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Criar senha no primeiro acesso do profissional' })
  async userSetupPassword(
    @Req() req: any,
    @Body() body: { password: string },
  ): Promise<AuthResponseDto> {
    return this.authService.userSetupPassword(req.user.sub, body.password);
  }

  @Post('reset-professional-password/:professionalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin reseta senha de um profissional' })
  async resetProfessionalPassword(
    @Param('professionalId') professionalId: string,
  ) {
    return this.authService.resetProfessionalPassword(professionalId);
  }
}
