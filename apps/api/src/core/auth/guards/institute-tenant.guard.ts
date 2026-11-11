import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InstituteTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const targetInstituteId = request.params?.instituteId;

    if (!user || !user.sub || !user.role) {
      throw new UnauthorizedException('Authentication required');
    }

    // SUPER_ADMIN has cross-tenant oversight access
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!user.instituteId) {
      throw new ForbiddenException('Access denied: Institute membership context required');
    }

    // If an instituteId is specified in the route, verify user's institute matches
    if (targetInstituteId && user.instituteId !== targetInstituteId) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to access resources in another institute',
      );
    }

    return true;
  }
}
