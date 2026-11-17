import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './authenticated-request.interface.js';

const BEARER_TOKEN_PATTERN = /^Bearer (\S+)$/;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization ?? '';
    const bearerMatch = BEARER_TOKEN_PATTERN.exec(authorizationHeader);
    if (bearerMatch === null) {
      throw new UnauthorizedException();
    }
    const [, accessToken] = bearerMatch;
    request.user = await this.authService.authenticate(accessToken);
    return true;
  }
}
