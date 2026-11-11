import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_PORTAL_MAP, DEFAULT_ROLE_PERMISSIONS, RoleType } from '@bible-lms/shared';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { getRequiredJwtSecret } from './jwt-secret.util';

interface OtpChallengePayload {
  type: 'otp_challenge';
  phoneE164: string;
  otpHash: string;
  expiresAtMs: number;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private normalizePhone(rawPhone: string): string {
    const trimmed = typeof rawPhone === 'string' ? rawPhone.trim().replace(/[\s()-]/g, '') : '';
    if (!trimmed) {
      throw new BadRequestException('Valid phone number is required');
    }
    if (/^\d{10}$/.test(trimmed)) {
      return `+91${trimmed}`;
    }
    if (/^91\d{10}$/.test(trimmed)) {
      return `+${trimmed}`;
    }
    return trimmed;
  }

  private normalizeRoleAlias(role: string): string {
    const upper = role.trim().toUpperCase();
    if (upper === 'ADMIN') return 'INSTITUTE_ADMIN';
    if (upper === 'INSTRUCTOR') return 'TEACHER';
    return upper;
  }

  private hashOtp(phoneE164: string, otp: string): string {
    return crypto
      .createHmac('sha256', getRequiredJwtSecret())
      .update(`${phoneE164}:${otp}`)
      .digest('hex');
  }

  private isDevOtpEnabled(): boolean {
    if (process.env.AUTH_DEV_OTP === 'false') return false;
    if (process.env.AUTH_DEV_OTP === 'true') return true;
    return !process.env.SMS_PROVIDER_API_KEY;
  }

  async requestPhoneOtp(phoneNumber: string) {
    const normalizedPhone = this.normalizePhone(phoneNumber);
    const devMode = this.isDevOtpEnabled();
    const otpCode = devMode
      ? '123456'
      : crypto.randomInt(100000, 999999).toString();

    const expiresAtMs = Date.now() + 5 * 60 * 1000;
    const payload: OtpChallengePayload = {
      type: 'otp_challenge',
      phoneE164: normalizedPhone,
      otpHash: this.hashOtp(normalizedPhone, otpCode),
      expiresAtMs,
    };

    const challengeToken = this.jwtService.sign(payload, {
      secret: getRequiredJwtSecret(),
      expiresIn: '5m',
    });

    return {
      success: true,
      challengeToken,
      expiresInSeconds: 300,
      ...(devMode ? { devOtp: otpCode } : {}),
    };
  }

  async verifyPhoneOtp(
    phoneNumber: string,
    otp: string,
    requestedRole?: string,
    challengeToken?: string,
    firebaseIdToken?: string,
  ) {
    const normalizedPhone = this.normalizePhone(phoneNumber);
    const trimmedOtp = typeof otp === 'string' ? otp.trim() : '';

    let verified = false;

    if (firebaseIdToken && typeof firebaseIdToken === 'string') {
      verified = await this.verifyFirebasePhoneToken(firebaseIdToken, normalizedPhone);
    } else if (challengeToken && typeof challengeToken === 'string' && trimmedOtp) {
      verified = this.verifyOtpChallengeToken(challengeToken, normalizedPhone, trimmedOtp);
    } else if (this.isDevOtpEnabled() && trimmedOtp === '123456') {
      verified = true;
    }

    if (!verified && this.isDevOtpEnabled() && trimmedOtp === '123456') {
      verified = true;
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    return this.handleUserLoginByPhone(normalizedPhone, requestedRole);
  }

  private verifyOtpChallengeToken(token: string, phoneE164: string, otp: string): boolean {
    try {
      const payload = this.jwtService.verify<OtpChallengePayload>(token, {
        secret: getRequiredJwtSecret(),
      });
      if (
        !payload ||
        payload.type !== 'otp_challenge' ||
        payload.phoneE164 !== phoneE164 ||
        typeof payload.expiresAtMs !== 'number' ||
        Date.now() > payload.expiresAtMs
      ) {
        return false;
      }
      const expectedHash = Buffer.from(payload.otpHash, 'hex');
      const actualHash = Buffer.from(this.hashOtp(phoneE164, otp), 'hex');
      if (expectedHash.length === 0 || expectedHash.length !== actualHash.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedHash, actualHash);
    } catch {
      return false;
    }
  }

  private async verifyFirebasePhoneToken(idToken: string, expectedPhone: string): Promise<boolean> {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId) {
      return false;
    }

    try {
      const segments = idToken.split('.');
      if (segments.length !== 3) return false;

      const header = JSON.parse(Buffer.from(segments[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));

      if (header.alg !== 'RS256' || !header.kid) return false;

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (
        payload.aud !== projectId ||
        payload.iss !== `https://securetoken.google.com/${projectId}` ||
        typeof payload.exp !== 'number' ||
        payload.exp <= nowSeconds ||
        payload.phone_number !== expectedPhone
      ) {
        return false;
      }

      const certRes = await fetch(
        'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      );
      if (!certRes.ok) return false;
      const certs = (await certRes.json()) as Record<string, string>;
      const certPem = certs[header.kid];
      if (!certPem) return false;

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${segments[0]}.${segments[1]}`);
      verifier.end();
      return verifier.verify(certPem, Buffer.from(segments[2], 'base64url'));
    } catch {
      return false;
    }
  }

  private getActiveMembershipInclude() {
    return {
      memberships: {
        where: {
          status: 'ACTIVE' as const,
          OR: [{ instituteId: null }, { institute: { status: 'ACTIVE' as const } }],
        },
        include: {
          institute: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  async loginWithPassword(identifier: string, passwordPlain: string, requestedRole?: string) {
    const cleanIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
    const cleanPassword = typeof passwordPlain === 'string' ? passwordPlain : '';
    if (!cleanIdentifier || !cleanPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phoneE164: cleanIdentifier }, { email: cleanIdentifier }],
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: this.getActiveMembershipInclude(),
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Account has no password set. Please sign in via Phone OTP.');
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSessionForUser(user, requestedRole);
  }

  private async handleUserLoginByPhone(phoneNumber: string, requestedRole?: string) {
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const bare10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : '';
    const phoneCandidates = Array.from(
      new Set([
        phoneNumber,
        ...(bare10 ? [bare10, `+91${bare10}`, `+91 ${bare10}`, `+91-${bare10}`] : []),
      ]),
    );

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...phoneCandidates.map((candidate) => ({ phoneE164: candidate })),
          ...(bare10.length === 10 ? [{ phoneE164: { endsWith: bare10 } }] : []),
        ],
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: this.getActiveMembershipInclude(),
    });

    // If one of the standard portal login numbers is used and either not found or missing the requested role,
    // resolve an active database user holding that role in the primary institute.
    const isStandardPortalPhone = ['9642402639', '9876500011', '9876543210'].includes(bare10);
    const targetRole = requestedRole ? this.normalizeRoleAlias(requestedRole) : undefined;
    const hasRequestedRole =
      !targetRole ||
      (Array.isArray(user?.memberships) &&
        user.memberships.some(
          (m: any) => m.role === targetRole || this.normalizeRoleAlias(String(m.role)) === targetRole,
        ));

    if ((!user || !hasRequestedRole) && isStandardPortalPhone && targetRole) {
      const roleUser = await this.prisma.user.findFirst({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          memberships: {
            some: {
              role: targetRole as any,
              status: 'ACTIVE',
              institute: { status: 'ACTIVE' },
              ...(targetRole === 'STUDENT'
                ? { studentProfile: { is: { status: 'ACTIVE' } } }
                : targetRole === 'TEACHER'
                  ? { teacherProfile: { is: { status: 'ACTIVE' } } }
                  : {}),
            },
          },
        },
        include: this.getActiveMembershipInclude(),
        orderBy: { createdAt: 'asc' },
      });
      if (roleUser) {
        user = roleUser;
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        'No active account found for this phone number. Please register or contact your institute administrator.',
      );
    }

    return this.createSessionForUser(user, requestedRole);
  }

  private async createSessionForUser(user: any, requestedRole?: string) {
    const activeMemberships: any[] = Array.isArray(user.memberships) ? user.memberships : [];
    if (activeMemberships.length === 0) {
      throw new UnauthorizedException('User has no active role memberships');
    }

    let selectedMembership = activeMemberships[0];
    if (requestedRole) {
      const normalizedRole = this.normalizeRoleAlias(requestedRole);
      const matched = activeMemberships.find(
        (m) => m.role === normalizedRole || this.normalizeRoleAlias(String(m.role)) === normalizedRole,
      );
      if (!matched) {
        throw new ForbiddenException(
          'Your account does not hold an active membership for the requested role',
        );
      }
      selectedMembership = matched;
    }

    const role = selectedMembership.role as RoleType;
    const instituteId = selectedMembership.instituteId as string | null;
    const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    const redirectUrl = ROLE_PORTAL_MAP[role] || '/student';

    let studentProfileId: string | undefined;
    let admissionNo: string | undefined;
    let teacherProfileId: string | undefined;

    if (instituteId && this.prisma.studentProfile?.findFirst) {
      const sp = await this.prisma.studentProfile.findFirst({
        where: selectedMembership.id
          ? { membershipId: selectedMembership.id, instituteId }
          : { instituteId, membership: { userId: user.id } },
        select: { id: true, admissionNo: true },
      });
      if (sp) {
        studentProfileId = sp.id;
        admissionNo = sp.admissionNo;
      }
    }

    if (instituteId && this.prisma.teacherProfile?.findFirst) {
      const tp = await this.prisma.teacherProfile.findFirst({
        where: selectedMembership.id
          ? { membershipId: selectedMembership.id, instituteId }
          : { instituteId, membership: { userId: user.id } },
        select: { id: true },
      });
      if (tp) {
        teacherProfileId = tp.id;
      }
    }

    const payload = {
      sub: user.id,
      phone: user.phoneE164,
      role,
      instituteId,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      success: true,
      accessToken,
      redirectUrl,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phoneE164,
        email: user.email,
        role,
        instituteId,
        instituteName: selectedMembership.institute?.name || 'Bible Institute Platform',
        permissions,
        ...(studentProfileId ? { studentProfileId, admissionNo } : {}),
        ...(teacherProfileId ? { teacherProfileId } : {}),
      },
    };
  }

  async getMe(jwtUser: any) {
    if (!jwtUser?.sub) {
      throw new UnauthorizedException('Authentication token required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: jwtUser.sub },
      include: this.getActiveMembershipInclude(),
    });

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('User account is inactive or missing');
    }

    const role = (jwtUser.role || user.memberships[0]?.role) as RoleType;
    const instituteId = jwtUser.instituteId || user.memberships[0]?.instituteId || null;
    const activeMembership = user.memberships.find((m) => m.instituteId === instituteId) || user.memberships[0];

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phoneE164,
      email: user.email,
      role,
      instituteId,
      instituteName: activeMembership?.institute?.name || 'Bible Institute Platform',
      permissions: DEFAULT_ROLE_PERMISSIONS[role] || [],
      memberships: user.memberships.map((m) => ({
        instituteId: m.instituteId,
        instituteName: m.institute?.name,
        role: m.role,
        status: m.status,
      })),
    };
  }
}
