import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';
import { buildPdfBuffer, PdfSection } from '@/lib/pdf-generator';
import { isHttpUrl, resolveVideoSource } from '@/lib/media-utils';

export interface ResourceRecord {
  id: string;
  instituteId: string;
  lessonId: string;
  mediaAssetId: string;
  downloadable: boolean;
  createdAt: string;
  storageKey: string;
  kind: string;
  mimeType: string;
  sizeBytes: string;
  videoStreamId: string | null;
  lessonTitle: string;
  lessonType: string;
  lessonBody: string | null;
  durationSec: number;
  isPreview: boolean;
  isMandatory: boolean;
  chapterTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  instituteName: string;
}

export async function fetchResourceRecord(
  resourceId: string,
  instituteId: string
): Promise<ResourceRecord | null> {
  const rows = await queryDb<any>(
    `SELECT
       lr.id,
       lr."instituteId",
       lr."lessonId",
       lr."mediaAssetId",
       lr.downloadable,
       lr."createdAt",
       ma."storageKey",
       ma.kind,
       ma."mimeType",
       ma."sizeBytes"::text as "sizeBytes",
       ma."videoStreamId",
       l.title as "lessonTitle",
       l.type as "lessonType",
       l.body as "lessonBody",
       l."durationSec",
       l."isPreview",
       l."isMandatory",
       ch.title as "chapterTitle",
       m.title as "moduleTitle",
       c.id as "courseId",
       c.title as "courseTitle",
       c.slug as "courseSlug",
       i.name as "instituteName"
     FROM "LessonResource" lr
     JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
     JOIN "Lesson" l ON l.id = lr."lessonId"
     JOIN "Chapter" ch ON ch.id = l."chapterId"
     JOIN "Module" m ON m.id = ch."moduleId"
     JOIN "Course" c ON c.id = m."courseId"
     JOIN "Institute" i ON i.id = lr."instituteId"
     WHERE lr.id = $1 AND lr."instituteId" = $2
     LIMIT 1`,
    [resourceId, instituteId]
  );

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

export function buildResourceMetadataPayload(resource: ResourceRecord, basePath: string) {
  const fileName = resource.storageKey.split('/').pop() || `${resource.lessonTitle}.pdf`;
  const effectiveSource = resource.videoStreamId || resource.storageKey;
  const video = resolveVideoSource(effectiveSource);

  return {
    id: resource.id,
    lessonId: resource.lessonId,
    mediaAssetId: resource.mediaAssetId,
    courseId: resource.courseId,
    title: fileName,
    storageKey: resource.storageKey,
    videoStreamId: resource.videoStreamId,
    kind: resource.kind,
    mimeType: resource.mimeType,
    sizeBytes: resource.sizeBytes,
    downloadable: resource.downloadable,
    courseTitle: resource.courseTitle,
    moduleTitle: resource.moduleTitle,
    chapterTitle: resource.chapterTitle,
    lessonTitle: resource.lessonTitle,
    lessonBody: resource.lessonBody,
    durationSec: resource.durationSec || 0,
    createdAt: resource.createdAt,
    isExternalUrl: video.isExternalUrl || isHttpUrl(resource.storageKey) || resource.storageKey.startsWith('data:'),
    video,
    downloadUrl: resource.downloadable ? `${basePath}?download=1` : null,
    viewUrl: `${basePath}?inline=1`,
  };
}

function safeFileName(name: string, fallbackExt = '.pdf'): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (clean.includes('.')) return clean;
  return `${clean}${fallbackExt}`;
}

export function buildResourceContentResponse(
  resource: ResourceRecord,
  options: { download: boolean; inline: boolean }
): NextResponse {
  if (options.download && !resource.downloadable) {
    return NextResponse.json(
      {
        success: false,
        error: 'Offline download is disabled for this Stream-Only DRM resource.',
      },
      { status: 403 }
    );
  }

  const rawFileName = resource.storageKey.split('/').pop() || `${resource.lessonTitle}.pdf`;

  if (isHttpUrl(resource.storageKey)) {
    return NextResponse.redirect(resource.storageKey, 302);
  }

  if (resource.storageKey.startsWith('data:')) {
    const match = resource.storageKey.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const buf = Buffer.from(match[2], 'base64');
      const disp = options.download ? 'attachment' : 'inline';
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': match[1] || resource.mimeType || 'application/octet-stream',
          'Content-Disposition': `${disp}; filename="${safeFileName(rawFileName)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  const pdfFileName = safeFileName(
    rawFileName.toLowerCase().endsWith('.pdf') ? rawFileName : `${rawFileName}.pdf`
  );

  const sections: PdfSection[] = [
    {
      heading: 'Lesson & Curriculum Reference',
      lines: [
        `Course: ${resource.courseTitle}`,
        `Module: ${resource.moduleTitle}`,
        `Chapter: ${resource.chapterTitle}`,
        `Lesson: ${resource.lessonTitle} (${resource.lessonType}${
          resource.durationSec > 0 ? ` - ${Math.round(resource.durationSec / 60)} min` : ''
        })`,
      ],
    },
    {
      heading: 'Study Guide & Faculty Notes',
      lines: [
        resource.lessonBody?.trim() ||
          'This academic study guide accompanies the structured theological curriculum. Review key passages, historical context, and seminar prompts alongside your assigned cohort readings.',
      ],
    },
    {
      heading: 'Resource Asset Details',
      lines: [
        `Document Name: ${rawFileName}`,
        `Resource Kind: ${resource.kind} (${resource.mimeType || 'application/pdf'})`,
        `Storage Reference: ${resource.storageKey}`,
        `Access Mode: ${resource.downloadable ? 'Downloadable Study PDF' : 'In-Platform Stream Only'}`,
        `Uploaded On: ${new Date(resource.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}`,
      ],
    },
  ];

  const pdfBytes = buildPdfBuffer({
    instituteName: resource.instituteName,
    title: resource.lessonTitle,
    subtitle: `${resource.courseTitle} - ${rawFileName}`,
    metadata: [
      `${resource.moduleTitle} > ${resource.chapterTitle}`,
    ],
    sections,
  });

  const disp = options.download ? 'attachment' : 'inline';
  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disp}; filename="${pdfFileName}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}

export async function buildCourseSyllabusPdfResponse(
  courseId: string,
  instituteId: string
): Promise<NextResponse | null> {
  const courseRows = await queryDb<any>(
    `SELECT c.id, c.title, c.slug, c.description, c.level, c.language, c.status,
            cat.name as "categoryName", i.name as "instituteName"
     FROM "Course" c
     LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
     JOIN "Institute" i ON i.id = c."instituteId"
     WHERE c.id = $1 AND c."instituteId" = $2 AND c."deletedAt" IS NULL
     LIMIT 1`,
    [courseId, instituteId]
  );

  if (courseRows.length === 0) return null;
  const course = courseRows[0];

  const [instructors, modules, chapters, lessons, resources, liveSessions] = await Promise.all([
    queryDb<any>(
      `SELECT u."fullName", ci.role
       FROM "CourseInstructor" ci
       JOIN "TeacherProfile" tp ON tp.id = ci."teacherProfileId"
       JOIN "Membership" m ON m.id = tp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       WHERE ci."courseId" = $1 AND ci."instituteId" = $2
       ORDER BY ci.role ASC, u."fullName" ASC`,
      [courseId, instituteId]
    ),
    queryDb<any>(
      `SELECT id, title, position FROM "Module"
       WHERE "courseId" = $1 AND "instituteId" = $2
       ORDER BY position ASC, "createdAt" ASC`,
      [courseId, instituteId]
    ),
    queryDb<any>(
      `SELECT ch.id, ch."moduleId", ch.title, ch.position
       FROM "Chapter" ch
       JOIN "Module" m ON m.id = ch."moduleId"
       WHERE m."courseId" = $1 AND ch."instituteId" = $2
       ORDER BY ch.position ASC, ch."createdAt" ASC`,
      [courseId, instituteId]
    ),
    queryDb<any>(
      `SELECT l.id, l."chapterId", l.title, l.type, l.body, l."durationSec", l."isMandatory"
       FROM "Lesson" l
       JOIN "Chapter" ch ON ch.id = l."chapterId"
       JOIN "Module" m ON m.id = ch."moduleId"
       WHERE m."courseId" = $1 AND l."instituteId" = $2
       ORDER BY l.position ASC, l."createdAt" ASC`,
      [courseId, instituteId]
    ),
    queryDb<any>(
      `SELECT lr."lessonId", lr.downloadable, ma."storageKey", ma.kind
       FROM "LessonResource" lr
       JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
       JOIN "Lesson" l ON l.id = lr."lessonId"
       JOIN "Chapter" ch ON ch.id = l."chapterId"
       JOIN "Module" m ON m.id = ch."moduleId"
       WHERE m."courseId" = $1 AND lr."instituteId" = $2
       ORDER BY lr."createdAt" ASC`,
      [courseId, instituteId]
    ),
    queryDb<any>(
      `SELECT ls.title, ls."startsAt", ls.status, ls."recordingUrl"
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       WHERE b."courseId" = $1 AND ls."instituteId" = $2
       ORDER BY ls."startsAt" DESC
       LIMIT 20`,
      [courseId, instituteId]
    ),
  ]);

  const sections: PdfSection[] = [];

  sections.push({
    heading: 'Course Overview',
    lines: [
      course.description ||
        'Structured theological curriculum covering foundational doctrine, exegesis, and ministry application.',
    ],
  });

  if (instructors.length > 0) {
    sections.push({
      heading: 'Assigned Faculty',
      lines: instructors.map((inst: any) => `* ${inst.fullName} (${inst.role})`),
    });
  }

  for (let mIdx = 0; mIdx < modules.length; mIdx++) {
    const mod = modules[mIdx];
    const modChapters = chapters.filter((c: any) => c.moduleId === mod.id);
    const lines: string[] = [];

    if (modChapters.length === 0) {
      lines.push('No chapters configured in this module.');
    } else {
      for (let cIdx = 0; cIdx < modChapters.length; cIdx++) {
        const chap = modChapters[cIdx];
        lines.push(`${mIdx + 1}.${cIdx + 1} ${chap.title}`);
        const chapLessons = lessons.filter((l: any) => l.chapterId === chap.id);
        for (const les of chapLessons) {
          const mins = les.durationSec > 0 ? `${Math.round(les.durationSec / 60)} min` : 'Self-paced';
          const tag = les.isMandatory ? 'Required' : 'Optional';
          lines.push(`   - ${les.title} [${les.type} | ${mins} | ${tag}]`);
          if (les.body) {
            lines.push(`     Notes: ${les.body}`);
          }
          const lesRes = resources.filter((r: any) => r.lessonId === les.id);
          for (const r of lesRes) {
            const name = String(r.storageKey || '').split('/').pop() || r.storageKey;
            lines.push(
              `     * Attachment: ${name} (${r.kind}, ${r.downloadable ? 'Downloadable' : 'Stream Only'})`
            );
          }
        }
      }
    }

    sections.push({
      heading: `Module ${mIdx + 1}: ${mod.title}`,
      lines,
    });
  }

  if (liveSessions.length > 0) {
    sections.push({
      heading: 'Live & Recorded Class Sessions',
      lines: liveSessions.map((s: any) => {
        const dateStr = new Date(s.startsAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const rec = s.recordingUrl ? `Recording: ${s.recordingUrl}` : 'Recording pending';
        return `* ${s.title} (${dateStr} - ${s.status}) | ${rec}`;
      }),
    });
  }

  const pdfBytes = buildPdfBuffer({
    instituteName: course.instituteName,
    title: `${course.title} - Official Syllabus`,
    subtitle: `${course.categoryName || 'Academic Course'} | Level: ${course.level || 'General'} | Language: ${
      course.language || 'English'
    }`,
    metadata: [
      `Modules: ${modules.length} | Chapters: ${chapters.length} | Lessons: ${lessons.length} | Study Materials: ${resources.length}`,
      `Course Code: ${course.slug} | Status: ${course.status}`,
    ],
    sections,
  });

  const slug = safeFileName(`${course.slug || 'course'}-syllabus`, '.pdf');
  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}"`,
      'Content-Length': String(pdfBytes.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
