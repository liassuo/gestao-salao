import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, AuthResponseDto, GoogleAuthDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
