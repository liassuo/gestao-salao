import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Busca roles definidas no decorator (método ou classe)
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se não tem @Roles(), permite acesso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Pega usuário do request (injetado pelo JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();

    // Verifica se role do usuário está nas roles permitidas
    return requiredRoles.includes(user.role);
  }
}
