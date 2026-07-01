import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_SCOPES_KEY } from '../../common/decorators/require-scopes.decorator';
import { JwtPayload } from '../token.service';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user || !user.scopes) {
      throw new ForbiddenException('No scopes in token');
    }

    // Super principal bypass semua scope check
    if ((user as any).isSuper === true) return true;

    const hasScope = requiredScopes.some((required) => {
      // Support wildcard matching: "product:read:*" matches "product:read:electronics"
      if (required.endsWith(':*')) {
        const prefix = required.slice(0, -1);
        return user.scopes.some((s) => s.startsWith(prefix));
      }
      return user.scopes.includes(required);
    });

    if (!hasScope) {
      throw new ForbiddenException(
        `Insufficient scopes. Required: ${requiredScopes.join(' | ')}`,
      );
    }

    return true;
  }
}
