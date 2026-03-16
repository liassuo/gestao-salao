import { Controller, Post, Patch, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
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
}
