import * as crypto from 'crypto';
import {
  Injectable,
  Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CourseSummaryItem,
  CourseHierarchyDetail,
  ModuleItemDetail,
  ChapterItemDetail,
  LessonItemDetail,
  ResourceItemDetail,
  CourseInstructorDetail,
  CreateCourseInput,
  UpdateCourseInput,
  CreateCourseCategoryInput,
  UpdateCourseCategoryInput,
  UpsertCompletionRuleInput,
  UpdateResourceInput,
  CourseFilterQuery,
  CreateModuleInput,
  UpdateModuleInput,
  CreateChapterInput,
  UpdateChapterInput,
  CreateLessonInput,
  UpdateLessonInput,
  CreateResourceInput,
  AssignCourseInstructorInput,
  ReorderCurriculumInput,
  PaginatedResult,
} from '@bible-lms/shared';
import { CourseLevel, CourseStatus, CourseType, LearningMode, PricingType, LessonType } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Helper to generate unique slug per institute
   */
  private async generateUniqueSlug(instituteId: string, baseTitle: string): Promise<string> {
    const rawSlug = baseTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = rawSlug || 'course';
    let count = 1;

    while (true) {
      const existing = await this.prisma.course.findUnique({
        where: { instituteId_slug: { instituteId, slug } },
      });
      if (!existing) break;
      slug = `${rawSlug}-${count++}`;
    }

    return slug;
  }

  /**
   * List courses with filtering, pagination, and multi-tenant scoping
   */
  async findAll(
    instituteId: string,
    query: CourseFilterQuery,
  ): Promise<PaginatedResult<CourseSummaryItem>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      instituteId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status as CourseStatus;
    }

    if (query.level) {
      where.level = query.level as CourseLevel;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.courseType && query.courseType !== 'ALL') {
      where.courseType = query.courseType as any;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, courses] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'updatedAt']: query.sortOrder || 'desc' },
        include: {
          category: true,
          instructors: {
            where: { role: 'LEAD' },
            include: {
              teacherProfile: {
                include: { membership: { include: { user: true } } },
              },
            },
            take: 1,
          },
          modules: {
            include: {
              chapters: {
                include: {
                  lessons: true,
                },
              },
            },
          },
          _count: {
            select: { enrolments: true },
          },
        },
      }),
    ]);

    const data: CourseSummaryItem[] = (courses as any[]).map((c) => {
      let lessonCount = 0;
      let totalDurationSec = 0;

      for (const m of c.modules || []) {
        for (const ch of m.chapters || []) {
          lessonCount += ch.lessons?.length || 0;
          for (const l of ch.lessons || []) {
            totalDurationSec += l.durationSec || 0;
          }
        }
      }

      const leadInstructor = c.instructors?.[0]?.teacherProfile?.membership?.user?.fullName;

      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        categoryId: c.categoryId,
        categoryName: c.category?.name || 'Uncategorized',
        level: c.level as any,
        courseType: (c.courseType || 'COHORT') as any,
        learningMode: (c.learningMode || 'ONLINE') as any,
        durationLabel: c.durationLabel || undefined,
        eligibility: c.eligibility || undefined,
        language: c.language,
        pricing: c.pricing as any,
        price: c.price,
        salePrice: c.salePrice || undefined,
        registrationFee: c.registrationFee ?? 0,
        requiresApproval: c.requiresApproval ?? true,
        enrollmentStartsAt: c.enrollmentStartsAt ? c.enrollmentStartsAt.toISOString() : undefined,
        enrollmentEndsAt: c.enrollmentEndsAt ? c.enrollmentEndsAt.toISOString() : undefined,
        status: c.status as any,
        coverImage: c.coverImage || undefined,
        author: c.author || undefined,
        pdfStorageKey: c.pdfStorageKey || undefined,
        pdfOriginalName: c.pdfOriginalName || undefined,
        pdfFileSize: c.pdfFileSize || undefined,
        pdfPageCount: c.pdfPageCount || undefined,
        publicationInfo: c.publicationInfo || undefined,
        bookMetadata: c.bookMetadata || undefined,
        enrolledCount: c._count?.enrolments || 0,
        moduleCount: c.modules?.length || 0,
        lessonCount,
        durationMinutes: Math.round(totalDurationSec / 60),
        leadTeacherName: leadInstructor,
        updatedAt: c.updatedAt.toISOString(),
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Find single course with full hierarchy: Modules -> Chapters -> Lessons -> Resources
   */
  async findOne(instituteId: string, courseId: string): Promise<CourseHierarchyDetail> {
    const course: any = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        instituteId,
        deletedAt: null,
      },
      include: {
        category: true,
        instructors: {
          include: {
            teacherProfile: {
              include: { membership: { include: { user: true } } },
            },
          },
        },
        modules: {
          orderBy: { position: 'asc' },
          include: {
            chapters: {
              orderBy: { position: 'asc' },
              include: {
                lessons: {
                  orderBy: { position: 'asc' },
                  include: {
                    resources: {
                      include: { mediaAsset: true },
                    },
                  },
                },
              },
            },
          },
        },
        completionRule: true,
        _count: {
          select: { enrolments: true },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in this institute');
    }

    let lessonCount = 0;
    let totalDurationSec = 0;

    const modules: ModuleItemDetail[] = (course.modules || []).map((m: any) => {
      const chapters: ChapterItemDetail[] = (m.chapters || []).map((ch: any) => {
        lessonCount += ch.lessons?.length || 0;
        const lessons: LessonItemDetail[] = (ch.lessons || []).map((l: any) => {
          totalDurationSec += l.durationSec || 0;
          const resources: ResourceItemDetail[] = (l.resources || []).map((r: any) => ({
            id: r.id,
            lessonId: r.lessonId,
            mediaAssetId: r.mediaAssetId,
            kind: r.mediaAsset?.kind || 'FILE',
            storageKey: r.mediaAsset?.storageKey || '',
            mimeType: r.mediaAsset?.mimeType || '',
            sizeBytes: r.mediaAsset?.sizeBytes?.toString() || '0',
            downloadable: r.downloadable,
            createdAt: r.createdAt.toISOString(),
          }));

          return {
            id: l.id,
            chapterId: l.chapterId,
            title: l.title,
            type: l.type as any,
            body: l.body || undefined,
            durationSec: l.durationSec,
            isPreview: l.isPreview,
            isMandatory: l.isMandatory,
            position: l.position,
            resources,
          };
        });

        return {
          id: ch.id,
          moduleId: ch.moduleId,
          title: ch.title,
          position: ch.position,
          lessons,
        };
      });

      return {
        id: m.id,
        courseId: m.courseId,
        title: m.title,
        position: m.position,
        chapters,
      };
    });

    const instructors: CourseInstructorDetail[] = (course.instructors || []).map((ins: any) => ({
      id: ins.id,
      courseId: ins.courseId,
      teacherProfileId: ins.teacherProfileId,
      teacherName: ins.teacherProfile?.membership?.user?.fullName || 'Instructor',
      teacherEmail: ins.teacherProfile?.membership?.user?.email || undefined,
      role: ins.role as any,
    }));

    const leadInstructor = instructors.find((i) => i.role === 'LEAD')?.teacherName;

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      categoryId: course.categoryId,
      categoryName: course.category?.name || 'Uncategorized',
      level: course.level as any,
      courseType: (course.courseType || 'COHORT') as any,
      learningMode: (course.learningMode || 'ONLINE') as any,
      durationLabel: course.durationLabel || undefined,
      eligibility: course.eligibility || undefined,
      language: course.language,
      pricing: course.pricing as any,
      price: course.price,
      salePrice: course.salePrice || undefined,
      registrationFee: course.registrationFee ?? 0,
      requiresApproval: course.requiresApproval ?? true,
      enrollmentStartsAt: course.enrollmentStartsAt ? course.enrollmentStartsAt.toISOString() : undefined,
      enrollmentEndsAt: course.enrollmentEndsAt ? course.enrollmentEndsAt.toISOString() : undefined,
      status: course.status as any,
      coverImage: course.coverImage || undefined,
      author: course.author || undefined,
      pdfStorageKey: course.pdfStorageKey || undefined,
      pdfOriginalName: course.pdfOriginalName || undefined,
      pdfFileSize: course.pdfFileSize || undefined,
      pdfPageCount: course.pdfPageCount || undefined,
      publicationInfo: course.publicationInfo || undefined,
      bookMetadata: course.bookMetadata || undefined,
      description: course.description,
      accessDays: course.accessDays || undefined,
      enrolledCount: course._count?.enrolments || 0,
      moduleCount: modules.length,
      lessonCount,
      durationMinutes: Math.round(totalDurationSec / 60),
      leadTeacherName: leadInstructor,
      updatedAt: course.updatedAt.toISOString(),
      modules,
      instructors,
      completionRule: course.completionRule
        ? {
            minProgressPct: course.completionRule.minProgressPct,
            allMandatory: course.completionRule.allMandatory,
            minExamPct: course.completionRule.minExamPct,
            minAttendancePct: course.completionRule.minAttendancePct,
          }
        : undefined,
    };
  }

  /**
   * Create a new course with category lookup and optional lead teacher
   */
  async create(instituteId: string, input: CreateCourseInput): Promise<CourseHierarchyDetail> {
    // 1. Resolve category
    let categoryId = input.categoryId;
    if (!categoryId) {
      const catName = input.categoryName || 'General Studies';
      const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const category = await this.prisma.courseCategory.upsert({
        where: { instituteId_slug: { instituteId, slug: catSlug } },
        update: {},
        create: {
          instituteId,
          name: catName,
          slug: catSlug,
        },
      });
      categoryId = category.id;
    } else {
      const existingCategory = await this.prisma.courseCategory.findFirst({
        where: { id: categoryId, instituteId },
      });
      if (!existingCategory) {
        throw new BadRequestException('Category not found in this institute');
      }
    }

    // 2. Generate slug
    const slug = input.slug
      ? input.slug
      : await this.generateUniqueSlug(instituteId, input.title);

    // 3. Create course transactionally
    const course = await this.prisma.$transaction(async (tx) => {
      const newCourse = await tx.course.create({
        data: {
          instituteId,
          categoryId,
          title: input.title,
          slug,
          description: input.description,
          level: (input.level as CourseLevel) || CourseLevel.BEGINNER,
          courseType: ((input.courseType || 'REGULAR') as any),
          learningMode: ((input.learningMode || 'ONLINE') as LearningMode),
          durationLabel: input.durationLabel || null,
          eligibility: input.eligibility || null,
          language: input.language || 'English',
          pricing: (input.pricing as PricingType) || PricingType.FREE,
          price: input.price || 0,
          salePrice: input.salePrice || null,
          registrationFee: input.registrationFee ?? 0,
          accessDays: input.accessDays || null,
          enrollmentStartsAt: input.enrollmentStartsAt ? new Date(input.enrollmentStartsAt) : null,
          enrollmentEndsAt: input.enrollmentEndsAt ? new Date(input.enrollmentEndsAt) : null,
          requiresApproval: input.requiresApproval ?? true,
          coverImage: input.coverImage || null,
          status: (input.status as CourseStatus) || CourseStatus.DRAFT,
          author: input.author || null,
          pdfStorageKey: input.pdfStorageKey || null,
          pdfOriginalName: input.pdfOriginalName || null,
          pdfFileSize: input.pdfFileSize ?? null,
          pdfPageCount: input.pdfPageCount ?? null,
          publicationInfo: input.publicationInfo || null,
          bookMetadata: input.bookMetadata ? (input.bookMetadata as any) : undefined,
          completionRule: {
            create: {
              instituteId,
              minProgressPct: 100,
              allMandatory: true,
              minExamPct: 60,
              minAttendancePct: 75,
            },
          },
        },
      });

      // If lead teacher specified, assign them
      if (input.leadTeacherId) {
        const teacher = await tx.teacherProfile.findFirst({
          where: { id: input.leadTeacherId, instituteId },
        });
        if (teacher) {
          await tx.courseInstructor.create({
            data: {
              instituteId,
              courseId: newCourse.id,
              teacherProfileId: teacher.id,
              role: 'LEAD',
            },
          });
        }
      }

      return newCourse;
    });

    const detail = await this.findOne(instituteId, course.id);

    if (this.notificationsService) {
      await this.notificationsService
        .emitAcademicEvent(instituteId, {
          eventType:
            detail.status === 'PUBLISHED' ? 'COURSE_PUBLISHED' : 'COURSE_CREATED',
          referenceId: detail.id,
          title:
            detail.status === 'PUBLISHED'
              ? 'New Course Published'
              : 'New Course Created',
          body: `Course "${detail.title}" (${detail.level}) was created in ${detail.categoryName}.`,
          link: `/admin/courses/${detail.id}`,
        })
        .catch(() => {});
    }

    return detail;
  }

  /**
   * Update course details
   */
  async update(
    instituteId: string,
    courseId: string,
    input: UpdateCourseInput,
  ): Promise<CourseHierarchyDetail> {
    const existing = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Course not found in this institute');
    }

    if (input.categoryId) {
      const cat = await this.prisma.courseCategory.findFirst({
        where: { id: input.categoryId, instituteId },
      });
      if (!cat) throw new BadRequestException('Category does not belong to this institute');
    }

    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        title: input.title,
        slug: input.slug,
        categoryId: input.categoryId,
        description: input.description,
        level: input.level as CourseLevel,
        courseType: input.courseType as CourseType | undefined,
        learningMode: input.learningMode as LearningMode | undefined,
        durationLabel: input.durationLabel,
        eligibility: input.eligibility,
        language: input.language,
        pricing: input.pricing as PricingType,
        price: input.price,
        salePrice: input.salePrice,
        registrationFee: input.registrationFee,
        accessDays: input.accessDays,
        enrollmentStartsAt:
          input.enrollmentStartsAt === ''
            ? null
            : input.enrollmentStartsAt
              ? new Date(input.enrollmentStartsAt)
              : undefined,
        enrollmentEndsAt:
          input.enrollmentEndsAt === ''
            ? null
            : input.enrollmentEndsAt
              ? new Date(input.enrollmentEndsAt)
              : undefined,
        requiresApproval: input.requiresApproval,
        coverImage: input.coverImage,
        status: input.status as CourseStatus,
        author: input.author,
        pdfStorageKey: input.pdfStorageKey,
        pdfOriginalName: input.pdfOriginalName,
        pdfFileSize: input.pdfFileSize,
        pdfPageCount: input.pdfPageCount,
        publicationInfo: input.publicationInfo,
        bookMetadata: input.bookMetadata ? (input.bookMetadata as any) : undefined,
      },
    });

    return this.findOne(instituteId, courseId);
  }

  /**
   * Update course status (DRAFT, PUBLISHED, ARCHIVED)
   */
  async updateStatus(
    instituteId: string,
    courseId: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  ): Promise<CourseHierarchyDetail> {
    const existing = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Course not found in this institute');
    }

    await this.prisma.course.update({
      where: { id: courseId },
      data: { status: status as CourseStatus },
    });

    return this.findOne(instituteId, courseId);
  }

  /**
   * Module Management: Add module
   */
  async createModule(
    instituteId: string,
    courseId: string,
    input: CreateModuleInput,
  ): Promise<ModuleItemDetail> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Course not found in this institute');

    const lastModule = await this.prisma.module.findFirst({
      where: { courseId, instituteId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = input.position !== undefined ? input.position : (lastModule?.position ?? -1) + 1;

    const moduleRecord = await this.prisma.module.create({
      data: {
        instituteId,
        courseId,
        title: input.title,
        position,
      },
      include: {
        chapters: {
          include: { lessons: { include: { resources: { include: { mediaAsset: true } } } } },
        },
      },
    });

    return {
      id: moduleRecord.id,
      courseId: moduleRecord.courseId,
      title: moduleRecord.title,
      position: moduleRecord.position,
      chapters: [],
    };
  }

  /**
   * Module Management: Update module
   */
  async updateModule(
    instituteId: string,
    courseId: string,
    moduleId: string,
    input: UpdateModuleInput,
  ): Promise<ModuleItemDetail> {
    const moduleRecord = await this.prisma.module.findFirst({
      where: { id: moduleId, courseId, instituteId },
    });
    if (!moduleRecord) throw new NotFoundException('Module not found in this course');

    const updated = await this.prisma.module.update({
      where: { id: moduleId },
      data: {
        title: input.title,
        position: input.position,
      },
    });

    return {
      id: updated.id,
      courseId: updated.courseId,
      title: updated.title,
      position: updated.position,
      chapters: [],
    };
  }

  /**
   * Module Management: Delete module
   */
  async deleteModule(instituteId: string, courseId: string, moduleId: string): Promise<{ success: boolean }> {
    const moduleRecord = await this.prisma.module.findFirst({
      where: { id: moduleId, courseId, instituteId },
    });
    if (!moduleRecord) throw new NotFoundException('Module not found in this course');

    await this.prisma.module.delete({ where: { id: moduleId } });
    return { success: true };
  }

  /**
   * Chapter Management: Add chapter
   */
  async createChapter(
    instituteId: string,
    courseId: string,
    moduleId: string,
    input: CreateChapterInput,
  ): Promise<ChapterItemDetail> {
    const moduleRecord = await this.prisma.module.findFirst({
      where: { id: moduleId, courseId, instituteId },
    });
    if (!moduleRecord) throw new NotFoundException('Module not found in this course');

    const lastChapter = await this.prisma.chapter.findFirst({
      where: { moduleId, instituteId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = input.position !== undefined ? input.position : (lastChapter?.position ?? -1) + 1;

    const chapter = await this.prisma.chapter.create({
      data: {
        instituteId,
        moduleId,
        title: input.title,
        position,
      },
    });

    return {
      id: chapter.id,
      moduleId: chapter.moduleId,
      title: chapter.title,
      position: chapter.position,
      lessons: [],
    };
  }

  /**
   * Chapter Management: Update chapter
   */
  async updateChapter(
    instituteId: string,
    courseId: string,
    chapterId: string,
    input: UpdateChapterInput,
  ): Promise<ChapterItemDetail> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, instituteId, module: { courseId } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found in this course');

    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        title: input.title,
        position: input.position,
      },
    });

    return {
      id: updated.id,
      moduleId: updated.moduleId,
      title: updated.title,
      position: updated.position,
      lessons: [],
    };
  }

  /**
   * Chapter Management: Delete chapter
   */
  async deleteChapter(instituteId: string, courseId: string, chapterId: string): Promise<{ success: boolean }> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, instituteId, module: { courseId } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found in this course');

    await this.prisma.chapter.delete({ where: { id: chapterId } });
    return { success: true };
  }

  /**
   * Lesson Management: Add lesson
   */
  async createLesson(
    instituteId: string,
    courseId: string,
    chapterId: string,
    input: CreateLessonInput,
  ): Promise<LessonItemDetail> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, instituteId, module: { courseId } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found in this course');

    const lastLesson = await this.prisma.lesson.findFirst({
      where: { chapterId, instituteId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = input.position !== undefined ? input.position : (lastLesson?.position ?? -1) + 1;

    const lesson = await this.prisma.lesson.create({
      data: {
        instituteId,
        chapterId,
        title: input.title,
        type: (input.type as LessonType) || LessonType.VIDEO,
        body: input.body || null,
        durationSec: input.durationSec || 0,
        isPreview: input.isPreview || false,
        isMandatory: input.isMandatory !== undefined ? input.isMandatory : true,
        position,
      },
      include: {
        resources: { include: { mediaAsset: true } },
      },
    });

    return {
      id: lesson.id,
      chapterId: lesson.chapterId,
      title: lesson.title,
      type: lesson.type as any,
      body: lesson.body || undefined,
      durationSec: lesson.durationSec,
      isPreview: lesson.isPreview,
      isMandatory: lesson.isMandatory,
      position: lesson.position,
      resources: [],
    };
  }

  /**
   * Lesson Management: Update lesson
   */
  async updateLesson(
    instituteId: string,
    courseId: string,
    lessonId: string,
    input: UpdateLessonInput,
  ): Promise<LessonItemDetail> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, instituteId, chapter: { module: { courseId } } },
      include: { resources: { include: { mediaAsset: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found in this course');

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: input.title,
        type: input.type as LessonType,
        body: input.body,
        durationSec: input.durationSec,
        isPreview: input.isPreview,
        isMandatory: input.isMandatory,
        position: input.position,
      },
      include: { resources: { include: { mediaAsset: true } } },
    });

    return {
      id: updated.id,
      chapterId: updated.chapterId,
      title: updated.title,
      type: updated.type as any,
      body: updated.body || undefined,
      durationSec: updated.durationSec,
      isPreview: updated.isPreview,
      isMandatory: updated.isMandatory,
      position: updated.position,
      resources: (updated.resources || []).map((r: any) => ({
        id: r.id,
        lessonId: r.lessonId,
        mediaAssetId: r.mediaAssetId,
        kind: r.mediaAsset?.kind || 'FILE',
        storageKey: r.mediaAsset?.storageKey || '',
        mimeType: r.mediaAsset?.mimeType || '',
        sizeBytes: r.mediaAsset?.sizeBytes?.toString() || '0',
        downloadable: r.downloadable,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Lesson Management: Delete lesson
   */
  async deleteLesson(instituteId: string, courseId: string, lessonId: string): Promise<{ success: boolean }> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, instituteId, chapter: { module: { courseId } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found in this course');

    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { success: true };
  }

  /**
   * Resource Management: Attach resource to lesson
   */
  async attachResource(
    instituteId: string,
    courseId: string,
    lessonId: string,
    input: CreateResourceInput,
    ownerUserId: string = 'system',
  ): Promise<ResourceItemDetail> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, instituteId, chapter: { module: { courseId } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found in this course');

    const result = await this.prisma.$transaction(async (tx) => {
      // Create or reuse MediaAsset
      let asset = await tx.mediaAsset.findUnique({
        where: { storageKey: input.storageKey },
      });

      if (!asset) {
        asset = await tx.mediaAsset.create({
          data: {
            instituteId,
            ownerUserId,
            kind: input.kind,
            storageKey: input.storageKey,
            mimeType: input.mimeType,
            sizeBytes: BigInt(input.sizeBytes || '1024000'),
          },
        });
      }

      const resource = await tx.lessonResource.create({
        data: {
          instituteId,
          lessonId,
          mediaAssetId: asset.id,
          downloadable: input.downloadable || false,
        },
        include: { mediaAsset: true },
      });

      return resource;
    });

    return {
      id: result.id,
      lessonId: result.lessonId,
      mediaAssetId: result.mediaAssetId,
      kind: result.mediaAsset.kind,
      storageKey: result.mediaAsset.storageKey,
      mimeType: result.mediaAsset.mimeType,
      sizeBytes: result.mediaAsset.sizeBytes.toString(),
      downloadable: result.downloadable,
      createdAt: result.createdAt.toISOString(),
    };
  }

  /**
   * Resource Management: Remove resource
   */
  async removeResource(instituteId: string, courseId: string, resourceId: string): Promise<{ success: boolean }> {
    const resource = await this.prisma.lessonResource.findFirst({
      where: {
        id: resourceId,
        instituteId,
        lesson: { chapter: { module: { courseId } } },
      },
    });
    if (!resource) throw new NotFoundException('Resource not found in this course');

    await this.prisma.lessonResource.delete({ where: { id: resourceId } });
    return { success: true };
  }

  /**
   * Curriculum Reordering: Reorder modules, chapters, or lessons
   */
  async reorderCurriculum(
    instituteId: string,
    courseId: string,
    input: ReorderCurriculumInput,
  ): Promise<{ success: boolean }> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Course not found in this institute');

    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        if (input.entityType === 'module') {
          const mod = await tx.module.findFirst({
            where: { id: item.id, courseId, instituteId },
          });
          if (!mod) {
            throw new BadRequestException(`Module ${item.id} does not belong to course ${courseId}`);
          }
          await tx.module.update({
            where: { id: item.id },
            data: { position: item.position },
          });
        } else if (input.entityType === 'chapter') {
          const chap = await tx.chapter.findFirst({
            where: { id: item.id, instituteId, module: { courseId } },
          });
          if (!chap) {
            throw new BadRequestException(`Chapter ${item.id} does not belong to course ${courseId}`);
          }
          await tx.chapter.update({
            where: { id: item.id },
            data: { position: item.position },
          });
        } else if (input.entityType === 'lesson') {
          const les = await tx.lesson.findFirst({
            where: { id: item.id, instituteId, chapter: { module: { courseId } } },
          });
          if (!les) {
            throw new BadRequestException(`Lesson ${item.id} does not belong to course ${courseId}`);
          }
          await tx.lesson.update({
            where: { id: item.id },
            data: { position: item.position },
          });
        }
      }
    });

    return { success: true };
  }

  /**
   * Protected Resource Delivery & DRM Authorization
   * Verifies enrolment, instructor assignment, preview rules, and enforces downloadable flags
   */
  async authorizeResourceAccess(
    instituteId: string,
    courseId: string,
    lessonId: string,
    resourceId: string,
    user: { sub: string; role: string; instituteId?: string },
    requestDownload: boolean = false,
  ) {
    // 1. Verify course exists in this institute
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!course) {
      throw new NotFoundException('Course not found in this institute');
    }

    // 2. Verify lesson belongs to this course hierarchy
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        instituteId,
        chapter: { module: { courseId } },
      },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found in this course hierarchy');
    }

    // 3. Verify resource belongs to this lesson
    const resource = await this.prisma.lessonResource.findFirst({
      where: { id: resourceId, instituteId, lessonId },
      include: { mediaAsset: true },
    });
    if (!resource) {
      throw new NotFoundException('Resource not found in this lesson');
    }

    // 4. Role-based entitlement checks
    if (user.role === 'STUDENT') {
      if (course.status === 'DRAFT') {
        throw new ForbiddenException('This course is currently in draft status and not accessible to students');
      }

      // If lesson is not previewable, verify student active enrolment
      if (!lesson.isPreview) {
        const enrolment = await this.prisma.enrolment.findFirst({
          where: {
            instituteId,
            courseId,
            status: 'ACTIVE',
            studentProfile: {
              membership: { userId: user.sub },
            },
          },
        });
        if (!enrolment) {
          throw new ForbiddenException('You must be actively enrolled in this course to access protected lesson materials');
        }
      }
    } else if (user.role === 'TEACHER') {
      // Verify teacher is assigned to this course or has admin role
      const isAssigned = await this.prisma.courseInstructor.findFirst({
        where: {
          courseId,
          instituteId,
          teacherProfile: {
            membership: { userId: user.sub },
          },
        },
      });
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned as an instructor for this course');
      }
    }

    // 5. DRM Download Restriction Enforcement
    if (requestDownload && !resource.downloadable) {
      throw new ForbiddenException(
        'Offline download is restricted for this resource. It is DRM-protected for in-platform viewing and streaming only.',
      );
    }

    // 6. Return HMAC-SHA256 signed delivery payload (prevents client-side token forgery)
    const signingSecret =
      process.env.RESOURCE_SIGNING_SECRET ||
      process.env.JWT_SECRET ||
      'dev-resource-signing-key';
    const payloadB64 = Buffer.from(
      JSON.stringify({
        instituteId,
        courseId,
        lessonId,
        resourceId,
        assetId: resource.mediaAssetId,
        storageKey: resource.mediaAsset.storageKey,
        kind: resource.mediaAsset.kind,
        mode: requestDownload ? 'DOWNLOAD' : 'STREAM',
        userId: user?.sub || 'guest',
        expiresAt: Date.now() + 15 * 60 * 1000,
      }),
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', signingSecret)
      .update(payloadB64)
      .digest('base64url');
    const signedAccessToken = `${payloadB64}.${signature}`;

    return {
      resourceId: resource.id,
      fileName: resource.mediaAsset.storageKey,
      kind: resource.mediaAsset.kind,
      mimeType: resource.mediaAsset.mimeType,
      sizeBytes: resource.mediaAsset.sizeBytes.toString(),
      accessMode: requestDownload ? 'ATTACHMENT_DOWNLOAD' : 'INLINE_STREAM',
      signedAccessToken,
      streamUrl: `/api/v1/institutes/${instituteId}/courses/${courseId}/lessons/${lessonId}/resources/${resourceId}/stream?token=${signedAccessToken}`,
      expiresInSeconds: 900,
    };
  }

  /**
   * Faculty Management: Assign teacher to course
   */
  async assignInstructor(
    instituteId: string,
    courseId: string,
    input: AssignCourseInstructorInput,
  ): Promise<CourseInstructorDetail> {
    const [course, teacher] = await Promise.all([
      this.prisma.course.findFirst({ where: { id: courseId, instituteId, deletedAt: null } }),
      this.prisma.teacherProfile.findFirst({
        where: { id: input.teacherProfileId, instituteId },
        include: { membership: { include: { user: true } } },
      }),
    ]);

    if (!course) throw new NotFoundException('Course not found in this institute');
    if (!teacher) throw new NotFoundException('Teacher not found in this institute');

    const instructor = await this.prisma.courseInstructor.upsert({
      where: {
        courseId_teacherProfileId: {
          courseId,
          teacherProfileId: input.teacherProfileId,
        },
      },
      update: { role: input.role },
      create: {
        instituteId,
        courseId,
        teacherProfileId: input.teacherProfileId,
        role: input.role,
      },
    });

    return {
      id: instructor.id,
      courseId: instructor.courseId,
      teacherProfileId: instructor.teacherProfileId,
      teacherName: teacher.membership?.user?.fullName || 'Instructor',
      teacherEmail: teacher.membership?.user?.email || undefined,
      role: instructor.role as any,
    };
  }

  /**
   * Faculty Management: Remove teacher from course
   */
  async removeInstructor(
    instituteId: string,
    courseId: string,
    teacherProfileId: string,
  ): Promise<{ success: boolean }> {
    const instructor = await this.prisma.courseInstructor.findFirst({
      where: { courseId, teacherProfileId, instituteId },
    });
    if (!instructor) throw new NotFoundException('Instructor assignment not found');

    await this.prisma.courseInstructor.delete({ where: { id: instructor.id } });
    return { success: true };
  }

  /**
   * List course categories for this institute (with active course count)
   */
  async listCategories(instituteId: string) {
    return this.prisma.courseCategory.findMany({
      where: { instituteId },
      include: {
        _count: {
          select: { courses: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a new course category for this institute
   */
  async createCategory(instituteId: string, input: CreateCourseCategoryInput) {
    const baseSlug = (input.slug || input.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'general';
    const existing = await this.prisma.courseCategory.findFirst({
      where: { instituteId, slug: baseSlug },
    });
    if (existing) {
      throw new ConflictException(`Category slug "${baseSlug}" already exists in this institute`);
    }
    return this.prisma.courseCategory.create({
      data: {
        instituteId,
        name: input.name.trim(),
        slug: baseSlug,
      },
    });
  }

  /**
   * Rename/update a course category
   */
  async updateCategory(
    instituteId: string,
    categoryId: string,
    input: UpdateCourseCategoryInput,
  ) {
    const category = await this.prisma.courseCategory.findFirst({
      where: { id: categoryId, instituteId },
    });
    if (!category) throw new NotFoundException('Category not found in this institute');

    return this.prisma.courseCategory.update({
      where: { id: categoryId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.slug ? { slug: input.slug.trim() } : {}),
      },
    });
  }

  /**
   * Delete an unused course category
   */
  async deleteCategory(instituteId: string, categoryId: string): Promise<{ success: boolean }> {
    const category = await this.prisma.courseCategory.findFirst({
      where: { id: categoryId, instituteId },
      include: { _count: { select: { courses: true } } },
    });
    if (!category) throw new NotFoundException('Category not found in this institute');
    if (category._count.courses > 0) {
      throw new ConflictException(
        'Cannot delete category while courses are assigned to it. Reassign those courses first.',
      );
    }
    await this.prisma.courseCategory.delete({ where: { id: categoryId } });
    return { success: true };
  }

  /**
   * Soft-archive & hide a course cleanly while preserving enrolment/order history
   */
  async softDelete(instituteId: string, courseId: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Course not found in this institute');

    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        deletedAt: new Date(),
        status: CourseStatus.ARCHIVED,
      },
    });
    return { success: true };
  }

  /**
   * Update a resource (e.g., toggle DRM downloadable flag)
   */
  async updateResource(
    instituteId: string,
    courseId: string,
    resourceId: string,
    input: UpdateResourceInput,
  ): Promise<ResourceItemDetail> {
    const resource = await this.prisma.lessonResource.findFirst({
      where: {
        id: resourceId,
        instituteId,
        lesson: { chapter: { module: { courseId, instituteId } } },
      },
      include: { mediaAsset: true },
    });
    if (!resource) {
      throw new NotFoundException('Resource not found in this course');
    }

    const updated = await this.prisma.lessonResource.update({
      where: { id: resourceId },
      data: {
        ...(input.downloadable !== undefined ? { downloadable: input.downloadable } : {}),
      },
      include: { mediaAsset: true },
    });

    return {
      id: updated.id,
      lessonId: updated.lessonId,
      mediaAssetId: updated.mediaAssetId,
      kind: updated.mediaAsset.kind,
      storageKey: updated.mediaAsset.storageKey,
      mimeType: updated.mediaAsset.mimeType,
      sizeBytes: updated.mediaAsset.sizeBytes.toString(),
      downloadable: updated.downloadable,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Upsert course completion rule
   */
  async upsertCompletionRule(
    instituteId: string,
    courseId: string,
    input: UpsertCompletionRuleInput,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Course not found in this institute');

    return this.prisma.completionRule.upsert({
      where: { courseId },
      update: {
        minProgressPct: input.minProgressPct,
        allMandatory: input.allMandatory,
        minExamPct: input.minExamPct,
        minAttendancePct: input.minAttendancePct,
      },
      create: {
        courseId,
        instituteId,
        minProgressPct: input.minProgressPct,
        allMandatory: input.allMandatory,
        minExamPct: input.minExamPct,
        minAttendancePct: input.minAttendancePct,
      },
    });
  }

  /**
   * List real enrolments for a course
   */
  async listCourseEnrolments(instituteId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Course not found in this institute');

    const enrolments = await this.prisma.enrolment.findMany({
      where: { instituteId, courseId },
      include: {
        batch: { select: { id: true, name: true } },
        studentProfile: {
          include: {
            membership: {
              include: {
                user: { select: { id: true, fullName: true, phoneE164: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return (enrolments as any[]).map((e) => ({
      id: e.id,
      studentProfileId: e.studentProfileId,
      admissionNo: e.studentProfile?.admissionNo || '',
      studentName: e.studentProfile?.membership?.user?.fullName || 'Student',
      phoneNumber: e.studentProfile?.membership?.user?.phoneE164 || undefined,
      email: e.studentProfile?.membership?.user?.email || undefined,
      batchId: e.batchId || undefined,
      batchName: e.batch?.name || undefined,
      status: e.status,
      source: e.source,
      progressPct: e.progressPct,
      enrolledAt: e.createdAt.toISOString(),
    }));
  }
}
