import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_PORTAL_MAP, DEFAULT_ROLE_PERMISSIONS, RoleType } from '@bible-lms/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async verifyPhoneOtp(phoneNumber: string, otp: string) {
    const isDev = process.env.AUTH_DEV_OTP === 'true';

    // In dev mode, verify with test OTP 123456
    if (isDev && otp === '123456') {
      return this.handleUserLoginByPhone(phoneNumber);
    }

    if (!isDev) {
      // In production, Firebase Admin token verification or SMS gateway check
      throw new BadRequestException('Production Firebase OTP verification is being configured.');
    }

    throw new UnauthorizedException('Invalid OTP code. For development, use 123456');
  }

  async loginWithPassword(identifier: string, passwordPlain: string) {
    // Find user by phone or email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phoneE164: identifier }, { email: identifier }],
      },
      include: {
        memberships: {
          include: {
            institute: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Account has no password set. Please sign in via Phone OTP.');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSessionForUser(user);
  }

  private async handleUserLoginByPhone(phoneNumber: string) {
    let user = await this.prisma.user.findUnique({
      where: { phoneE164: phoneNumber },
      include: {
        memberships: {
          include: {
            institute: true,
          },
        },
      },
    });

    if (!user) {
      // Auto-provision initial student user if not yet existing
      const defaultInstitute = await this.prisma.institute.findFirst();
      if (!defaultInstitute) {
        throw new BadRequestException('No default institute registered');
      }

      user = await this.prisma.user.create({
        data: {
          phoneE164: phoneNumber,
          fullName: 'New Bible Learner',
          memberships: {
            create: {
              instituteId: defaultInstitute.id,
              role: 'STUDENT',
              studentProfile: {
                create: {
                  instituteId: defaultInstitute.id,
                  admissionNo: `STU-${Date.now().toString().slice(-4)}`,
                },
              },
            },
          },
        },
        include: {
          memberships: {
            include: {
              institute: true,
            },
          },
        },
      });
    }

    return this.createSessionForUser(user);
  }

  private async createSessionForUser(user: any) {
    const activeMembership = user.memberships[0];
    if (!activeMembership) {
      throw new UnauthorizedException('User has no active role memberships');
    }

    const role = activeMembership.role as RoleType;
    const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    const redirectUrl = ROLE_PORTAL_MAP[role] || '/student';

    const payload = {
      sub: user.id,
      phone: user.phoneE164,
      role,
      instituteId: activeMembership.instituteId,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      redirectUrl,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phoneE164,
        email: user.email,
        role,
        instituteName: activeMembership.institute?.name || 'Bible Institute Platform',
      },
    };
  }
}
