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
      return NextResponse.json({ message: 'Only active STUDENT accounts may access profile.' }, { status: 403 });
    }

    const rows = await queryDb(
      `SELECT sp.id as "studentProfileId", sp."admissionNo", sp."dateOfBirth", sp.gender,
              sp.address, sp.guardian, sp.church, sp."preferredLanguage", sp.status as "academicStatus",
              sp."createdAt" as "enrolmentDate",
              u.id as "userId", u."fullName", u.email, u."phoneE164" as phone, u."avatarUrl",
              inst.name as "instituteName", inst.slug as "instituteSlug", inst."logoUrl"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "User" u ON m."userId" = u.id
       JOIN "Institute" inst ON m."instituteId" = inst.id
       WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       ${instituteId ? 'AND m."instituteId" = $2' : ''}
       LIMIT 1`,
      instituteId ? [userId, instituteId] : [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: 'No active student profile found.' }, { status: 404 });
    }

    const s = rows[0];

    const enrolments = await queryDb(
      `SELECT e.id as "enrolmentId", e."courseId", e.status, e."createdAt" as "enrolledAt",
              c.title as "courseTitle", c.slug as "courseSlug",
              b.name as "batchName"
       FROM "Enrolment" e
       JOIN "Course" c ON e."courseId" = c.id
       LEFT JOIN "Batch" b ON e."batchId" = b.id
       WHERE e."studentProfileId" = $1`,
      [s.studentProfileId]
    );

    return NextResponse.json({
      profile: {
        personal: {
          id: s.studentProfileId,
          fullName: s.fullName,
          email: s.email,
          phone: s.phone,
          avatarUrl: s.avatarUrl,
          dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString() : null,
          gender: s.gender,
          address: s.address,
          guardian: s.guardian,
          church: s.church,
          preferredLanguage: s.preferredLanguage || 'English',
        },
        academic: {
          admissionNo: s.admissionNo,
          instituteName: s.instituteName,
          instituteSlug: s.instituteSlug,
          instituteLogo: s.logoUrl,
          status: s.academicStatus,
          enrolmentDate: new Date(s.enrolmentDate).toISOString(),
          enrolledCourses: enrolments.map((e: any) => ({
            ...e,
            enrolledAt: new Date(e.enrolledAt).toISOString(),
          })),
        },
      },
    });
  } catch (error: any) {
    console.error('Student Profile GET Error:', error);
    return NextResponse.json(
      { message: 'Internal server error processing profile', error: error.message },
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may update profile.' }, { status: 403 });
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

    // Update User table fields
    if (body.phone || body.avatarUrl !== undefined) {
      const updates: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      if (body.phone) {
        updates.push(`"phoneE164" = $${pIdx++}`);
        params.push(body.phone.trim());
      }
      if (body.avatarUrl !== undefined) {
        updates.push(`"avatarUrl" = $${pIdx++}`);
        params.push(body.avatarUrl);
      }
      updates.push(`"updatedAt" = NOW()`);
      params.push(userId);

      await queryDb(
        `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${pIdx}`,
        params
      );
    }

    // Update StudentProfile fields
    const spUpdates: string[] = [];
    const spParams: any[] = [];
    let spIdx = 1;

    if (body.address !== undefined) {
      spUpdates.push(`address = $${spIdx++}`);
      spParams.push(typeof body.address === 'string' ? body.address : JSON.stringify(body.address));
    }
    if (body.church !== undefined) {
      spUpdates.push(`church = $${spIdx++}`);
      spParams.push(body.church ? body.church.trim() : null);
    }
    if (body.guardian !== undefined) {
      spUpdates.push(`guardian = $${spIdx++}`);
      spParams.push(typeof body.guardian === 'string' ? body.guardian : JSON.stringify(body.guardian));
    }
    if (body.preferredLanguage) {
      spUpdates.push(`"preferredLanguage" = $${spIdx++}`);
      spParams.push(body.preferredLanguage.trim());
    }

    if (spUpdates.length > 0) {
      spUpdates.push(`"updatedAt" = NOW()`);
      spParams.push(studentProfileId);
      await queryDb(
        `UPDATE "StudentProfile" SET ${spUpdates.join(', ')} WHERE id = $${spIdx}`,
        spParams
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Student profile updated successfully',
    });
  } catch (error: any) {
    console.error('Student Profile PATCH Error:', error);
    return NextResponse.json(
      { message: 'Internal server error updating profile', error: error.message },
      { status: 500 }
    );
  }
}

