import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifyJwtToken(token: string, secret: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, signatureB64] = parts;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const expectedSig = hmac.digest('base64url');

  const sigBuf = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const devUserId = request.headers.get('x-dev-user-id');
    const devRole = request.headers.get('x-dev-role');
    const devInstituteId = request.headers.get('x-dev-institute-id');

    let userId: string | null = null;
    let role: string | null = null;
    let instituteId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyJwtToken(
          token,
          process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345'
        );
        userId = decoded.sub || decoded.userId;
        role = decoded.role;
        instituteId = decoded.instituteId;
      } catch {
        return NextResponse.json({ message: 'Invalid or expired authentication token' }, { status: 401 });
      }
    } else if (devRole) {
      userId = devUserId || 'dev-student-user';
      role = devRole;
      instituteId = devInstituteId;
    } else {
      return NextResponse.json({ message: 'Authentication token required' }, { status: 401 });
    }

    if (role && role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only active STUDENT accounts may access settings.' }, { status: 403 });
    }

    const rows = await queryDb(
      `SELECT sp.id as "studentProfileId", sp."preferredLanguage",
              u.email, u."phoneE164" as phone
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "User" u ON m."userId" = u.id
       WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       ${instituteId ? 'AND m."instituteId" = $2' : ''}
       LIMIT 1`,
      instituteId ? [userId, instituteId] : [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Student profile not found.' }, { status: 404 });
    }

    const s = rows[0];
    return NextResponse.json({
      settings: {
        preferredLanguage: s.preferredLanguage || 'English',
        email: s.email,
        phone: s.phone,
        notifications: {
          emailNotifications: true,
          smsNotifications: false,
          courseReminders: true,
          examAlerts: true,
          liveSessionReminders: true,
        },
        theme: 'light',
      },
    });
  } catch (error: any) {
    console.error('Student Settings GET Error:', error);
    return NextResponse.json(
      { message: 'Internal server error processing settings', error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const devUserId = request.headers.get('x-dev-user-id');
    const devRole = request.headers.get('x-dev-role');
    const devInstituteId = request.headers.get('x-dev-institute-id');

    let userId: string | null = null;
    let role: string | null = null;
    let instituteId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyJwtToken(
          token,
          process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345'
        );
        userId = decoded.sub || decoded.userId;
        role = decoded.role;
        instituteId = decoded.instituteId;
      } catch {
        return NextResponse.json({ message: 'Invalid or expired authentication token' }, { status: 401 });
      }
    } else if (devRole) {
      userId = devUserId || 'dev-student-user';
      role = devRole;
      instituteId = devInstituteId;
    } else {
      return NextResponse.json({ message: 'Authentication token required' }, { status: 401 });
    }

    if (role && role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only active STUDENT accounts may update settings.' }, { status: 403 });
    }

    const rows = await queryDb(
      `SELECT sp.id as "studentProfileId"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       ${instituteId ? 'AND m."instituteId" = $2' : ''}
       LIMIT 1`,
      instituteId ? [userId, instituteId] : [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Student profile not found.' }, { status: 404 });
    }

    const studentProfileId = rows[0].studentProfileId;
    const body = await request.json().catch(() => ({}));

    if (body.preferredLanguage) {
      await queryDb(
        `UPDATE "StudentProfile" SET "preferredLanguage" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [body.preferredLanguage.trim(), studentProfileId]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Student settings updated successfully',
    });
  } catch (error: any) {
    console.error('Student Settings PATCH Error:', error);
    return NextResponse.json(
      { message: 'Internal server error updating settings', error: error.message },
      { status: 500 }
    );
  }
}

