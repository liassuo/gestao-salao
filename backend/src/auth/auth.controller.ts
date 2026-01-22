import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, AuthResponseDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('client/login')
  @HttpCode(HttpStatus.OK)
  async clientLogin(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.clientLogin(loginDto);
  }
}
