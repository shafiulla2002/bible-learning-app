import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';
import {
  fetchResourceRecord,
  buildResourceMetadataPayload,
  buildResourceContentResponse,
} from '@/lib/server-materials';

export const dynamic = 'force-dynamic';

async function verifyTeacherCourseAccess(
  courseId: string,
  teacherProfileId: string,
  instituteId: string
): Promise<boolean> {
  const rows = await queryDb<{ role: string }>(
    `SELECT role FROM (
      SELECT ci.role, 1 as priority
      FROM "CourseInstructor" ci
      WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
      UNION ALL
      SELECT bt.role, 2 as priority
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE b."courseId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
    ) a LIMIT 1`,
    [courseId, teacherProfileId, instituteId]
  );
  return rows.length > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const { resourceId } = await params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const resource = await fetchResourceRecord(resourceId, instituteId);
    if (!resource) {
      return NextResponse.json(
        { success: false, error: 'Study material not found in your institute' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyTeacherCourseAccess(
      resource.courseId,
      teacherProfileId,
      instituteId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to this course.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isMeta = searchParams.get('meta') === '1';
    if (isMeta) {
      return NextResponse.json({
        success: true,
        data: buildResourceMetadataPayload(
          resource,
          `/api/teachers/materials/${resourceId}/content`
        ),
      });
    }

    const download = searchParams.get('download') === '1';
    const inline = searchParams.get('inline') === '1' || !download;

    // Faculty previewing their own course syllabus materials may open/download even Stream-Only PDFs if requested,
    // while keeping downloadable flag intact for UI display.
    return buildResourceContentResponse(
      { ...resource, downloadable: resource.downloadable || true },
      { download, inline }
    );
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher material content GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error serving material content' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const { resourceId } = await params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const resource = await fetchResourceRecord(resourceId, instituteId);
    if (!resource) {
      return NextResponse.json(
        { success: false, error: 'Study material not found in your institute' },
        { status: 404 }
      );
    }

    const hasAccess = await verifyTeacherCourseAccess(
      resource.courseId,
      teacherProfileId,
      instituteId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to this course.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Request body required' },
        { status: 400 }
      );
    }

    const newStorageKey =
      typeof body.storageKey === 'string' && body.storageKey.trim()
        ? body.storageKey.trim()
        : resource.storageKey;

    const newVideoStreamId =
      body.videoStreamId !== undefined
        ? body.videoStreamId
          ? String(body.videoStreamId).trim()
          : null
        : resource.videoStreamId;

    const newDownloadable =
      body.downloadable !== undefined ? Boolean(body.downloadable) : resource.downloadable;

    if (newStorageKey !== resource.storageKey || newVideoStreamId !== resource.videoStreamId) {
      await queryDb(
        `UPDATE "MediaAsset"
         SET "storageKey" = $1, "videoStreamId" = $2
         WHERE id = $3 AND "instituteId" = $4`,
        [newStorageKey, newVideoStreamId, resource.mediaAssetId, instituteId]
      );
    }

    if (newDownloadable !== resource.downloadable) {
      await queryDb(
        `UPDATE "LessonResource"
         SET downloadable = $1
         WHERE id = $2 AND "instituteId" = $3`,
        [newDownloadable, resource.id, instituteId]
      );
    }

    const updated = await fetchResourceRecord(resourceId, instituteId);
    return NextResponse.json({
      success: true,
      data: updated
        ? buildResourceMetadataPayload(updated, `/api/teachers/materials/${resourceId}/content`)
        : null,
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher material PATCH error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update material resource' },
      { status: 500 }
    );
  }
}
