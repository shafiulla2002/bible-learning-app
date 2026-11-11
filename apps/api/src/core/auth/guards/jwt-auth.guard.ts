import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRequiredJwtSecret } from '../jwt-secret.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    let token = '';
    let fromCookie = false;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (request.cookies) {
      token =
        request.cookies.auth_token ||
        request.cookies.access_token ||
        request.cookies.token ||
        '';
      if (token) {
        fromCookie = true;
      }
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    const secret = getRequiredJwtSecret();

    try {
      const payload = this.jwtService.verify(token, { secret });
      if (!payload || typeof payload !== 'object' || !payload.sub || !payload.role) {
        throw new UnauthorizedException('Invalid authentication token payload');
      }

      // Enforce double-submit CSRF token on cookie-authenticated mutations
      const method = String(request.method || 'GET').toUpperCase();
      if (fromCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfCookie = request.cookies?.csrf_token;
        const csrfHeader = request.headers['x-csrf-token'];
        if (csrfCookie && csrfHeader !== csrfCookie) {
          throw new ForbiddenException('Invalid CSRF token');
        }
      }

      request.user = payload;
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
