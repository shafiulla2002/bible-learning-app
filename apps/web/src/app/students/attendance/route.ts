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
      return NextResponse.json({ message: 'Only active STUDENT accounts may access attendance records.' }, { status: 403 });
    }

    // Resolve active student membership
    const membershipRows = await queryDb(
      `SELECT m.id as "membershipId", m."instituteId", m.role, m.status,
              sp.id as "studentProfileId", sp."admissionNo",
              u.id as "userId", u."fullName", u."avatarUrl"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "User" u ON m."userId" = u.id
       WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       ${instituteId ? 'AND m."instituteId" = $2' : ''}
       LIMIT 1`,
      instituteId ? [userId, instituteId] : [userId]
    );

    if (membershipRows.length === 0) {
      return NextResponse.json({ message: 'No active student profile found for this account.' }, { status: 403 });
    }

    const studentMembership = membershipRows[0];
    const resolvedInstituteId = studentMembership.instituteId;
    const studentProfileId = studentMembership.studentProfileId;

    const url = new URL(request.url);
    const filterBatchId = url.searchParams.get('batchId');
    const filterCourseId = url.searchParams.get('courseId');
    const filterStatus = url.searchParams.get('status');
    const filterMonth = url.searchParams.get('month');
    const filterStartDate = url.searchParams.get('startDate');
    const filterEndDate = url.searchParams.get('endDate');

    const params: any[] = [studentProfileId, resolvedInstituteId];
    let extraConditions = '';

    if (filterBatchId) {
      extraConditions += ` AND a."batchId" = $${params.length + 1}`;
      params.push(filterBatchId);
    }
    if (filterStatus) {
      extraConditions += ` AND a.status = $${params.length + 1}`;
      params.push(filterStatus);
    }
    if (filterStartDate) {
      extraConditions += ` AND a.date >= $${params.length + 1}`;
      params.push(filterStartDate);
    }
    if (filterEndDate) {
      extraConditions += ` AND a.date <= $${params.length + 1}`;
      params.push(filterEndDate);
    } else if (filterMonth) {
      extraConditions += ` AND TO_CHAR(a.date, 'YYYY-MM') = $${params.length + 1}`;
      params.push(filterMonth);
    }

    const recordRows = await queryDb(
      `SELECT a.id, a.date, a.status, a.mode, a.remarks, a."markedAt",
              b.id as "batchId", b.name as "batchName", b."courseId",
              c.id as "courseId", c.title as "courseTitle",
              ls.title as "sessionTitle",
              u."fullName" as "teacherName"
       FROM "Attendance" a
       JOIN "Batch" b ON a."batchId" = b.id
       JOIN "Course" c ON b."courseId" = c.id
       LEFT JOIN "LiveSession" ls ON a."liveSessionId" = ls.id
       LEFT JOIN "TeacherProfile" tp ON ls."teacherProfileId" = tp.id
       LEFT JOIN "Membership" tm ON tp."membershipId" = tm.id
       LEFT JOIN "User" u ON tm."userId" = u.id
       WHERE a."studentProfileId" = $1 AND a."instituteId" = $2 ${extraConditions}
       ORDER BY a.date DESC`,
      params
    );

    // Filter by courseId if requested
    const filteredRecords = filterCourseId
      ? recordRows.filter((r: any) => r.courseId === filterCourseId)
      : recordRows;

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    for (const r of filteredRecords) {
      if (r.status === 'PRESENT') presentCount++;
      else if (r.status === 'LATE') lateCount++;
      else if (r.status === 'ABSENT') absentCount++;
      else if (r.status === 'EXCUSED') excusedCount++;
    }

    const totalSessions = presentCount + lateCount + absentCount + excusedCount;
    const applicableTotal = totalSessions - excusedCount;
    const attendancePercentage =
      applicableTotal > 0 ? Math.round(((presentCount + lateCount) / applicableTotal) * 100) : null;
    const thresholdPercentage = 75;
    const isWarning = attendancePercentage !== null && attendancePercentage < thresholdPercentage;

    // Monthly breakdown
    const monthlyMap = new Map<string, { present: number; late: number; absent: number; excused: number }>();
    for (const r of filteredRecords) {
      const d = new Date(r.date);
      const monthKey = d.toISOString().slice(0, 7);
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { present: 0, late: 0, absent: 0, excused: 0 });
      }
      const entry = monthlyMap.get(monthKey)!;
      if (r.status === 'PRESENT') entry.present++;
      else if (r.status === 'LATE') entry.late++;
      else if (r.status === 'ABSENT') entry.absent++;
      else if (r.status === 'EXCUSED') entry.excused++;
    }

    const monthlySummary = Array.from(monthlyMap.entries())
      .map(([month, counts]) => {
        const mApplicable = counts.present + counts.late + counts.absent;
        const percentage = mApplicable > 0 ? Math.round(((counts.present + counts.late) / mApplicable) * 100) : null;
        return {
          month,
          present: counts.present,
          late: counts.late,
          absent: counts.absent,
          excused: counts.excused,
          percentage,
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    // Course summary breakdown
    const courseMap = new Map<string, { courseId: string; courseTitle: string; present: number; late: number; absent: number; excused: number }>();
    for (const r of filteredRecords) {
      const cid = r.courseId || 'general';
      const ctitle = r.courseTitle || 'General Lectures';
      if (!courseMap.has(cid)) {
        courseMap.set(cid, { courseId: cid, courseTitle: ctitle, present: 0, late: 0, absent: 0, excused: 0 });
      }
      const centry = courseMap.get(cid)!;
      if (r.status === 'PRESENT') centry.present++;
      else if (r.status === 'LATE') centry.late++;
      else if (r.status === 'ABSENT') centry.absent++;
      else if (r.status === 'EXCUSED') centry.excused++;
    }

    const courseSummary = Array.from(courseMap.values()).map((c) => {
      const cTotal = c.present + c.late + c.absent;
      return {
        ...c,
        total: cTotal + c.excused,
        percentage: cTotal > 0 ? Math.round(((c.present + c.late) / cTotal) * 100) : null,
      };
    });

    const mappedRecords = filteredRecords.map((r: any) => ({
      id: r.id,
      date: new Date(r.date).toISOString().slice(0, 10),
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      batchId: r.batchId,
      batchName: r.batchName,
      sessionTitle: r.sessionTitle || (r.mode === 'LIVE_SESSION' ? 'Live Session' : 'Cohort Lecture'),
      instructorName: r.teacherName || 'Faculty Instructor',
      mode: r.mode,
      status: r.status,
      remarks: r.remarks || null,
    }));

    // Enrolled courses and batches for dropdown filter options
    const enrolments = await queryDb(
      `SELECT b.id as "batchId", b.name as "batchName", c.id as "courseId", c.title as "courseTitle"
       FROM "Enrolment" e
       JOIN "Batch" b ON e."batchId" = b.id
       JOIN "Course" c ON b."courseId" = c.id
       WHERE e."studentProfileId" = $1 AND e.status IN ('ACTIVE', 'COMPLETED')`,
      [studentProfileId]
    );

    const filterOptions = {
      batches: enrolments.map((e: any) => ({ id: e.batchId, name: e.batchName, courseTitle: e.courseTitle })),
      courses: Array.from(
        new Map(enrolments.map((e: any) => [e.courseId, { id: e.courseId, title: e.courseTitle }])).values()
      ),
    };

    return NextResponse.json({
      student: {
        id: studentProfileId,
        admissionNo: studentMembership.admissionNo,
        fullName: studentMembership.fullName,
      },
      summary: {
        totalSessions,
        presentCount,
        lateCount,
        absentCount,
        excusedCount,
        attendancePercentage,
        thresholdPercentage,
        isWarning,
      },
      monthlySummary,
      courseSummary,
      records: mappedRecords,
      filterOptions,
    });
  } catch (error: any) {
    console.error('Error in GET /students/attendance:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

