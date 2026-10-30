import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    // 1. Check Bearer token in Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345',
        });
        request.user = payload;
        return true;
      } catch (err) {
        throw new UnauthorizedException('Invalid or expired authentication token');
      }
    }

    // 2. Allow simulated / dev header in non-production environments
    const isDev = process.env.NODE_ENV !== 'production';
    const devUserId = request.headers['x-dev-user-id'];
    const devRole = request.headers['x-dev-role'];
    const devInstituteId = request.headers['x-dev-institute-id'];

    if (isDev && devRole) {
      request.user = {
        sub: devUserId || 'dev-test-user-id',
        role: devRole,
        instituteId: devInstituteId || request.params?.instituteId,
        permissions: ['*'],
      };
      return true;
    }

    // In local development when accessing API without header, provide safe default institute admin user
    if (isDev && !authHeader) {
      request.user = {
        sub: 'dev-admin-user',
        role: 'INSTITUTE_ADMIN',
        instituteId: request.params?.instituteId || 'default-inst-id',
        permissions: ['*'],
      };
      return true;
    }

    throw new UnauthorizedException('Authentication token required');
  }
}
