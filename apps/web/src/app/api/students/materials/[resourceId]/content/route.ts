import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedStudent } from '@/lib/server-student';
import { queryDb } from '@/lib/server-db';
import {
  fetchResourceRecord,
  buildResourceMetadataPayload,
  buildResourceContentResponse,
} from '@/lib/server-materials';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const { resourceId } = await params;
    const student = await resolveAuthenticatedStudent(request);
    const { studentProfileId, instituteId } = student;

    const resource = await fetchResourceRecord(resourceId, instituteId);
    if (!resource) {
      return NextResponse.json(
        { success: false, error: 'Study material not found' },
        { status: 404 }
      );
    }

    if (!resource.isPreview) {
      const enrolRows = await queryDb(
        `SELECT id FROM "Enrolment"
         WHERE "studentProfileId" = $1 AND "courseId" = $2 AND "instituteId" = $3
         LIMIT 1`,
        [studentProfileId, resource.courseId, instituteId]
      );
      if (enrolRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'You must be enrolled in this course to access this material' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get('meta') === '1') {
      return NextResponse.json({
        success: true,
        data: buildResourceMetadataPayload(
          resource,
          `/api/students/materials/${resourceId}/content`
        ),
      });
    }

    const download = searchParams.get('download') === '1';
    const inline = searchParams.get('inline') === '1' || !download;

    return buildResourceContentResponse(resource, { download, inline });
  } catch (err: any) {
    console.error('Student material content GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Authentication or authorization failed' },
      { status: 401 }
    );
  }
}
