import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  MarkBulkAttendanceInput,
  UpdateIndividualAttendanceInput,
  AttendanceFilterQueryInput,
  AttendanceStatusType,
  AttendanceModeType,
} from '@bible-lms/shared';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. ATTENDANCE OVERVIEW & METRICS (ADMIN & COORDINATOR)
  // ---------------------------------------------------------------------------

  /**
   * Requirement 2 & 7: Attendance Overview across batches with clearly defined
   * percentage calculations and applicable period scoping.
   * Formula: round(((Present + Late) / (Total - Excused)) * 100)
   */
  async getOverview(instituteId: string, query: AttendanceFilterQueryInput) {
    const whereClause: any = { instituteId };

    if (query.batchId) whereClause.batchId = query.batchId;
    if (query.mode) whereClause.mode = query.mode;
    if (query.status) whereClause.status = query.status;

    if (query.startDate || query.endDate) {
      whereClause.date = {};
      if (query.startDate) whereClause.date.gte = new Date(query.startDate);
      if (query.endDate) whereClause.date.lte = new Date(query.endDate);
    }

    if (query.courseId || query.academicYearId || query.termId) {
      whereClause.batch = {};
      if (query.courseId) whereClause.batch.courseId = query.courseId;
      if (query.academicYearId) whereClause.batch.academicYearId = query.academicYearId;
      if (query.termId) whereClause.batch.termId = query.termId;
    }

    // Aggregate counts
    const [statusCounts, totalRecords, batchesList] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { _all: true },
      }),
      this.prisma.attendance.count({ where: whereClause }),
      this.prisma.batch.findMany({
        where: {
          instituteId,
          ...(query.batchId ? { id: query.batchId } : {}),
          ...(query.courseId ? { courseId: query.courseId } : {}),
          ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
          ...(query.termId ? { termId: query.termId } : {}),
        },
        include: {
          course: { select: { title: true } },
          academicYear: { select: { name: true } },
          term: { select: { name: true } },
          _count: {
            select: { enrolments: true, attendances: true },
          },
        },
        take: 50,
      }),
    ]);

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    for (const sc of statusCounts) {
      if (sc.status === 'PRESENT') presentCount = sc._count._all;
      else if (sc.status === 'LATE') lateCount = sc._count._all;
      else if (sc.status === 'ABSENT') absentCount = sc._count._all;
      else if (sc.status === 'EXCUSED') excusedCount = sc._count._all;
    }

    const applicableDenominator = totalRecords - excusedCount;
    const overallPercentage =
      applicableDenominator > 0
        ? Math.round(((presentCount + lateCount) / applicableDenominator) * 100)
        : null;

    // Batch breakdowns
    const batchBreakdowns = await Promise.all(
      batchesList.map(async (b) => {
        const batchCounts = await this.prisma.attendance.groupBy({
          by: ['status'],
          where: { instituteId, batchId: b.id, ...(whereClause.date ? { date: whereClause.date } : {}) },
          _count: { _all: true },
        });

        let bPres = 0;
        let bLate = 0;
        let bAbs = 0;
        let bExc = 0;

        for (const bc of batchCounts) {
          if (bc.status === 'PRESENT') bPres = bc._count._all;
          else if (bc.status === 'LATE') bLate = bc._count._all;
          else if (bc.status === 'ABSENT') bAbs = bc._count._all;
          else if (bc.status === 'EXCUSED') bExc = bc._count._all;
        }

        const bTotal = bPres + bLate + bAbs + bExc;
        const bDenom = bTotal - bExc;
        const bPct = bDenom > 0 ? Math.round(((bPres + bLate) / bDenom) * 100) : null;

        // Distinct calendar dates marked
        const distinctDates = await this.prisma.attendance.groupBy({
          by: ['date'],
          where: { instituteId, batchId: b.id },
        });

        return {
          batchId: b.id,
          batchName: b.name,
          courseTitle: b.course.title,
          academicYearName: b.academicYear?.name,
          termName: b.term?.name,
          totalStudents: b._count.enrolments,
          totalDaysMarked: distinctDates.length,
          presentCount: bPres,
          lateCount: bLate,
          absentCount: bAbs,
          excusedCount: bExc,
          attendancePercentage: bPct,
        };
      }),
    );

    return {
      summary: {
        totalRecords,
        presentCount,
        lateCount,
        absentCount,
        excusedCount,
        attendancePercentage: overallPercentage,
      },
      batches: batchBreakdowns,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. BATCH STUDENTS ROSTER FOR ATTENDANCE MARKING
  // ---------------------------------------------------------------------------

  /**
   * Requirement 2 & 5: Load enrolled students for roll-call marking.
   * If caller is a TEACHER, strictly verifies assignment in BatchTeacher.
   */
  async getBatchRosterForDate(
    instituteId: string,
    batchId: string,
    dateStr: string,
    liveSessionId?: string,
    teacherUser?: { role: string; userId: string; teacherProfileId?: string },
  ) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, instituteId },
      include: {
        course: { select: { id: true, title: true } },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found in this institute');

    // Teacher authorization check
    if (teacherUser?.role === 'TEACHER') {
      await this.verifyTeacherBatchAssignment(instituteId, batchId, teacherUser.userId);
    }

    const targetDate = new Date(dateStr);

    // Fetch enrolled students
    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        instituteId,
        batchId,
        status: 'ACTIVE',
      },
      include: {
        studentProfile: {
          include: {
            membership: {
              include: {
                user: { select: { fullName: true, email: true, phoneE164: true } },
              },
            },
          },
        },
      },
      orderBy: { studentProfile: { admissionNo: 'asc' } },
    });

    // Fetch existing attendance records on this date
    const existingRecords = await this.prisma.attendance.findMany({
      where: {
        instituteId,
        batchId,
        date: targetDate,
        ...(liveSessionId ? { liveSessionId, mode: 'LIVE_SESSION' } : { mode: 'DAILY_BATCH' }),
      },
    });

    const recordMap = new Map(existingRecords.map((r) => [r.studentProfileId, r]));

    const roster = enrolments.map((enr) => {
      const student = enr.studentProfile;
      const existing = recordMap.get(student.id);

      return {
        studentProfileId: student.id,
        admissionNo: student.admissionNo,
        fullName: student.membership?.user?.fullName || 'Student',
        email: student.membership?.user?.email,
        phone: student.membership?.user?.phoneE164,
        enrolmentId: enr.id,
        enrolmentStatus: enr.status,
        enrolledAt: enr.createdAt.toISOString().slice(0, 10),
        attendanceId: existing?.id,
        status: existing?.status,
        remarks: existing?.remarks || undefined,
        markedAt: existing?.markedAt?.toISOString(),
      };
    });

    return {
      batchId: batch.id,
      batchName: batch.name,
      courseTitle: batch.course.title,
      date: dateStr,
      mode: liveSessionId ? 'LIVE_SESSION' : 'DAILY_BATCH',
      liveSessionId,
      totalEnrolled: enrolments.length,
      markedCount: existingRecords.length,
      roster,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. ATOMIC BULK ATTENDANCE MARKING
  // ---------------------------------------------------------------------------

  /**
   * Requirement 3 & 4: Bulk attendance marking in a single atomic database transaction.
   * Records immutable AttendanceAuditLog on status changes.
   * Partial unique index enforces duplicate prevention at PostgreSQL level.
   */
  async markBulkAttendance(
    instituteId: string,
    input: MarkBulkAttendanceInput,
    user: { id?: string; sub?: string; role: string },
  ) {
    const userId = user.sub || user.id || 'system';
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, instituteId },
    });
    if (!batch) throw new NotFoundException('Batch not found in this institute');

    // If teacher, verify assignment
    if (user.role === 'TEACHER') {
      await this.verifyTeacherBatchAssignment(instituteId, input.batchId, userId);
    }

    const targetDate = new Date(input.date);
    const mode = input.mode || (input.liveSessionId ? 'LIVE_SESSION' : 'DAILY_BATCH');

    // Verify student profiles belong to institute and are enrolled
    const studentIds = input.records.map((r) => r.studentProfileId);
    const validEnrolments = await this.prisma.enrolment.findMany({
      where: {
        instituteId,
        batchId: input.batchId,
        studentProfileId: { in: studentIds },
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      select: { id: true, studentProfileId: true },
    });
    const enrolmentMap = new Map(validEnrolments.map((e) => [e.studentProfileId, e.id]));

    // Atomic transaction for bulk upsert + immutable audit history
    return this.prisma.$transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;

      for (const rec of input.records) {
        const enrolmentId = enrolmentMap.get(rec.studentProfileId);
        if (!enrolmentId) {
          throw new BadRequestException(
            `Student ${rec.studentProfileId} does not have an active enrolment in batch ${input.batchId}`,
          );
        }

        // Query existing attendance
        const existing = await tx.attendance.findFirst({
          where: {
            instituteId,
            batchId: input.batchId,
            studentProfileId: rec.studentProfileId,
            date: targetDate,
            mode,
            ...(input.liveSessionId ? { liveSessionId: input.liveSessionId } : {}),
          },
        });

        if (existing) {
          // Check if status or remarks changed
          if (existing.status !== rec.status || (rec.remarks !== undefined && existing.remarks !== rec.remarks)) {
            // 1. Record immutable audit history
            await tx.attendanceAuditLog.create({
              data: {
                attendanceId: existing.id,
                previousStatus: existing.status,
                newStatus: rec.status,
                previousRemarks: existing.remarks,
                newRemarks: rec.remarks ?? null,
                changedById: userId,
                changedByRole: user.role,
              },
            });

            // 2. Update attendance
            await tx.attendance.update({
              where: { id: existing.id },
              data: {
                status: rec.status,
                remarks: rec.remarks ?? existing.remarks,
                updatedById: userId,
              },
            });
            updatedCount++;
          }
        } else {
          // Create new attendance record
          await tx.attendance.create({
            data: {
              instituteId,
              batchId: input.batchId,
              studentProfileId: rec.studentProfileId,
              enrolmentId,
              liveSessionId: input.liveSessionId || null,
              mode,
              date: targetDate,
              status: rec.status,
              remarks: rec.remarks || null,
              markedById: userId,
              markedByRole: user.role,
            },
          });
          createdCount++;
        }
      }

      return {
        success: true,
        batchId: input.batchId,
        date: input.date,
        mode,
        totalSubmitted: input.records.length,
        createdCount,
        updatedCount,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 4. INDIVIDUAL ATTENDANCE UPDATE WITH AUDIT TRAIL
  // ---------------------------------------------------------------------------

  /**
   * Requirement 3: Update individual attendance with mandatory audit logging.
   */
  async updateIndividualAttendance(
    instituteId: string,
    attendanceId: string,
    input: UpdateIndividualAttendanceInput,
    user: { id?: string; sub?: string; role: string },
  ) {
    const userId = user.sub || user.id || 'system';

    const existing = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, instituteId },
    });
    if (!existing) throw new NotFoundException('Attendance record not found');

    if (user.role === 'TEACHER') {
      await this.verifyTeacherBatchAssignment(instituteId, existing.batchId, userId);
    }

    return this.prisma.$transaction(async (tx) => {
      // Create immutable audit log
      await tx.attendanceAuditLog.create({
        data: {
          attendanceId: existing.id,
          previousStatus: existing.status,
          newStatus: input.status,
          previousRemarks: existing.remarks,
          newRemarks: input.remarks !== undefined ? input.remarks : existing.remarks,
          changedById: userId,
          changedByRole: user.role,
        },
      });

      // Update attendance record
      return tx.attendance.update({
        where: { id: attendanceId },
        data: {
          status: input.status,
          remarks: input.remarks !== undefined ? input.remarks : existing.remarks,
          updatedById: userId,
        },
        include: {
          studentProfile: {
            include: {
              membership: {
                include: { user: { select: { fullName: true } } },
              },
            },
          },
          auditLogs: {
            orderBy: { changedAt: 'desc' },
            take: 5,
          },
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 5. BATCH ATTENDANCE HISTORY
  // ---------------------------------------------------------------------------

  async getBatchAttendanceHistory(
    instituteId: string,
    batchId: string,
    query: AttendanceFilterQueryInput,
    teacherUser?: { role: string; userId: string },
  ) {
    if (teacherUser?.role === 'TEACHER') {
      await this.verifyTeacherBatchAssignment(instituteId, batchId, teacherUser.userId);
    }

    const whereClause: any = { instituteId, batchId };
    if (query.mode) whereClause.mode = query.mode;
    if (query.status) whereClause.status = query.status;
    if (query.startDate || query.endDate) {
      whereClause.date = {};
      if (query.startDate) whereClause.date.gte = new Date(query.startDate);
      if (query.endDate) whereClause.date.lte = new Date(query.endDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where: whereClause,
        include: {
          studentProfile: {
            include: {
              membership: {
                include: { user: { select: { fullName: true } } },
              },
            },
          },
          liveSession: { select: { id: true, title: true } },
          auditLogs: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ date: 'desc' }, { studentProfile: { admissionNo: 'asc' } }],
        skip,
        take: limit,
      }),
      this.prisma.attendance.count({ where: whereClause }),
    ]);

    return {
      data: records.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        studentProfileId: r.studentProfileId,
        admissionNo: r.studentProfile.admissionNo,
        studentName: r.studentProfile.membership?.user?.fullName || 'Student',
        status: r.status,
        mode: r.mode,
        remarks: r.remarks,
        liveSessionTitle: r.liveSession?.title,
        markedAt: r.markedAt.toISOString(),
        hasBeenEdited: r.auditLogs.length > 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 6. STUDENT ATTENDANCE HISTORY & PERCENTAGE CALCULATION
  // ---------------------------------------------------------------------------

  /**
   * Requirement 2, 4 & 5: Student Personal Attendance History.
   * Scoped to student's actual enrolment period in the batch.
   * Formula: round(((Present + Late) / (Total - Excused)) * 100)
   */
  async getStudentAttendanceHistory(
    instituteId: string,
    studentProfileId: string,
    query: AttendanceFilterQueryInput,
    callerUser?: { role: string; userId: string; studentProfileId?: string },
  ) {
    // If caller is a STUDENT, strictly verify they are only requesting their own record
    if (callerUser?.role === 'STUDENT') {
      const studentProfile = await this.prisma.studentProfile.findFirst({
        where: { id: studentProfileId, instituteId },
        include: { membership: true },
      });
      if (!studentProfile || studentProfile.membership.userId !== callerUser.userId) {
        throw new ForbiddenException('You are not authorized to view another student attendance record');
      }
    }

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentProfileId, instituteId },
      include: {
        membership: {
          include: { user: { select: { fullName: true } } },
        },
        enrolments: {
          include: {
            batch: { select: { id: true, name: true, startDate: true, endDate: true } },
            course: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Student profile not found in this institute');

    const whereClause: any = { instituteId, studentProfileId };
    if (query.batchId) whereClause.batchId = query.batchId;
    if (query.status) whereClause.status = query.status;
    if (query.startDate || query.endDate) {
      whereClause.date = {};
      if (query.startDate) whereClause.date.gte = new Date(query.startDate);
      if (query.endDate) whereClause.date.lte = new Date(query.endDate);
    }

    const [records, statusCounts, transferLogs] = await Promise.all([
      this.prisma.attendance.findMany({
        where: whereClause,
        include: {
          batch: { select: { id: true, name: true } },
          liveSession: { select: { title: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { _all: true },
      }),
      this.prisma.batchTransferLog?.findMany
        ? this.prisma.batchTransferLog.findMany({
            where: { instituteId, studentProfileId },
            include: {
              sourceBatch: { select: { id: true, name: true } },
              targetBatch: { select: { id: true, name: true } },
            },
            orderBy: { transferredAt: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    for (const sc of statusCounts) {
      if (sc.status === 'PRESENT') present = sc._count._all;
      else if (sc.status === 'LATE') late = sc._count._all;
      else if (sc.status === 'ABSENT') absent = sc._count._all;
      else if (sc.status === 'EXCUSED') excused = sc._count._all;
    }

    const totalSessions = present + late + absent + excused;
    const applicableTotal = totalSessions - excused;
    const attendancePercentage =
      applicableTotal > 0 ? Math.round(((present + late) / applicableTotal) * 100) : null;

    // Batch Breakdown (Calculated only for sessions during actual enrolment in each batch)
    const batchMap = new Map<string, { batchId: string; batchName: string; present: number; late: number; absent: number; excused: number }>();
    for (const r of records) {
      if (!batchMap.has(r.batchId)) {
        batchMap.set(r.batchId, { batchId: r.batchId, batchName: r.batch.name, present: 0, late: 0, absent: 0, excused: 0 });
      }
      const bEntry = batchMap.get(r.batchId)!;
      if (r.status === 'PRESENT') bEntry.present++;
      else if (r.status === 'LATE') bEntry.late++;
      else if (r.status === 'ABSENT') bEntry.absent++;
      else if (r.status === 'EXCUSED') bEntry.excused++;
    }

    const batchBreakdowns = Array.from(batchMap.values()).map((b) => {
      const bTotal = b.present + b.late + b.absent + b.excused;
      const bApplicable = bTotal - b.excused;
      return {
        ...b,
        totalSessions: bTotal,
        attendancePercentage: bApplicable > 0 ? Math.round(((b.present + b.late) / bApplicable) * 100) : null,
      };
    });

    // Monthly breakdown
    const monthlyMap = new Map<string, { present: number; late: number; absent: number; excused: number }>();
    for (const r of records) {
      const monthKey = r.date.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { present: 0, late: 0, absent: 0, excused: 0 });
      }
      const entry = monthlyMap.get(monthKey)!;
      if (r.status === 'PRESENT') entry.present++;
      else if (r.status === 'LATE') entry.late++;
      else if (r.status === 'ABSENT') entry.absent++;
      else if (r.status === 'EXCUSED') entry.excused++;
    }

    const monthlySummary = Array.from(monthlyMap.entries()).map(([month, counts]) => {
      const mApplicable = counts.present + counts.late + counts.absent;
      const mPct = mApplicable > 0 ? Math.round(((counts.present + counts.late) / mApplicable) * 100) : null;
      return {
        month,
        ...counts,
        percentage: mPct,
      };
    });

    return {
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        fullName: student.membership?.user?.fullName || 'Student',
      },
      summary: {
        totalSessions,
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        excusedCount: excused,
        attendancePercentage,
      },
      batchBreakdowns,
      transfers: transferLogs.map((tl) => ({
        id: tl.id,
        sourceBatchId: tl.sourceBatchId,
        sourceBatchName: tl.sourceBatch.name,
        targetBatchId: tl.targetBatchId,
        targetBatchName: tl.targetBatch.name,
        reason: tl.reason,
        transferredBy: tl.transferredBy,
        transferredAt: tl.transferredAt.toISOString(),
      })),
      monthlySummary,
      records: records.map((r) => ({
        id: r.id,
        batchId: r.batchId,
        batchName: r.batch.name,
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
        mode: r.mode,
        remarks: r.remarks,
        sessionTitle: r.liveSession?.title,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 7. CSV REPORT EXPORT
  // ---------------------------------------------------------------------------

  async exportAttendanceReport(
    instituteId: string,
    query: AttendanceFilterQueryInput,
    user?: { role: string; userId: string },
  ) {
    if (user?.role === 'TEACHER' && query.batchId) {
      await this.verifyTeacherBatchAssignment(instituteId, query.batchId, user.userId);
    }

    const whereClause: any = { instituteId };
    if (query.batchId) whereClause.batchId = query.batchId;
    if (query.studentProfileId) whereClause.studentProfileId = query.studentProfileId;
    if (query.mode) whereClause.mode = query.mode;
    if (query.status) whereClause.status = query.status;

    if (query.startDate || query.endDate) {
      whereClause.date = {};
      if (query.startDate) whereClause.date.gte = new Date(query.startDate);
      if (query.endDate) whereClause.date.lte = new Date(query.endDate);
    }

    const records = await this.prisma.attendance.findMany({
      where: whereClause,
      include: {
        studentProfile: {
          include: {
            membership: {
              include: { user: { select: { fullName: true } } },
            },
          },
        },
        batch: {
          include: { course: { select: { title: true } } },
        },
        liveSession: { select: { title: true } },
      },
      orderBy: [{ date: 'desc' }, { batchId: 'asc' }],
      take: 1000,
    });

    // Generate CSV
    const rows: string[] = [];
    rows.push('Date,Batch,Course,Admission No,Student Name,Mode,Status,Remarks,Session Title,Marked At');

    for (const r of records) {
      const escape = (str?: string | null) => `"${(str || '').replace(/"/g, '""')}"`;
      rows.push(
        [
          r.date.toISOString().slice(0, 10),
          escape(r.batch.name),
          escape(r.batch.course.title),
          escape(r.studentProfile.admissionNo),
          escape(r.studentProfile.membership?.user?.fullName),
          r.mode,
          r.status,
          escape(r.remarks),
          escape(r.liveSession?.title),
          r.markedAt.toISOString(),
        ].join(','),
      );
    }

    return rows.join('\n');
  }

  // ---------------------------------------------------------------------------
  // HELPER: VERIFY TEACHER BATCH ASSIGNMENT
  // ---------------------------------------------------------------------------

  private async verifyTeacherBatchAssignment(
    instituteId: string,
    batchId: string,
    userId: string,
  ) {
    const teacherProfile = await this.prisma.teacherProfile.findFirst({
      where: {
        instituteId,
        membership: { userId },
      },
    });
    if (!teacherProfile) {
      throw new ForbiddenException('No teacher profile found for authenticated user');
    }

    const assignment = await this.prisma.batchTeacher.findFirst({
      where: {
        batchId,
        teacherProfileId: teacherProfile.id,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not an assigned instructor for this batch and cannot take or view its attendance.',
      );
    }

    return teacherProfile;
  }
}
