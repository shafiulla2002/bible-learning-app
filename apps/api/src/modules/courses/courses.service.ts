import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
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
import { CourseLevel, CourseStatus, PricingType, LessonType } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

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
        language: c.language,
        pricing: c.pricing as any,
        price: c.price,
        salePrice: c.salePrice || undefined,
        status: c.status as any,
        coverImage: c.coverImage || undefined,
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
      language: course.language,
      pricing: course.pricing as any,
      price: course.price,
      salePrice: course.salePrice || undefined,
      status: course.status as any,
      coverImage: course.coverImage || undefined,
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
          language: input.language || 'English',
          pricing: (input.pricing as PricingType) || PricingType.FREE,
          price: input.price || 0,
          salePrice: input.salePrice || null,
          accessDays: input.accessDays || null,
          coverImage: input.coverImage || null,
          status: (input.status as CourseStatus) || CourseStatus.DRAFT,
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

    return this.findOne(instituteId, course.id);
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
        language: input.language,
        pricing: input.pricing as PricingType,
        price: input.price,
        salePrice: input.salePrice,
        accessDays: input.accessDays,
        coverImage: input.coverImage,
        status: input.status as CourseStatus,
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
          await tx.module.updateMany({
            where: { id: item.id, courseId, instituteId },
            data: { position: item.position },
          });
        } else if (input.entityType === 'chapter') {
          await tx.chapter.updateMany({
            where: { id: item.id, instituteId, module: { courseId } },
            data: { position: item.position },
          });
        } else if (input.entityType === 'lesson') {
          await tx.lesson.updateMany({
            where: { id: item.id, instituteId, chapter: { module: { courseId } } },
            data: { position: item.position },
          });
        }
      }
    });

    return { success: true };
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
   * List course categories for this institute
   */
  async listCategories(instituteId: string) {
    return this.prisma.courseCategory.findMany({
      where: { instituteId },
      orderBy: { name: 'asc' },
    });
  }
}
