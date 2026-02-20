import {
  IsEmail,
  IsString,
  IsEnum,
  MinLength,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { UserRole } from '../../common/enums';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
  name: string;

  @IsEnum(UserRole, { message: 'Role deve ser ADMIN ou PROFESSIONAL' })
  role: UserRole;

  @IsOptional()
  @IsUUID()
  professionalId?: string;
}
