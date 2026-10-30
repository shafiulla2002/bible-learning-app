import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CoursesService } from '../src/modules/courses/courses.service';
import { CourseLevel, CourseStatus, PricingType, LessonType } from '@prisma/client';

describe('Milestone 2.2 — Course & Curriculum Management Audit', () => {
  let service: CoursesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      course: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      courseCategory: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      teacherProfile: {
        findFirst: jest.fn(),
      },
      courseInstructor: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      module: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      chapter: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      lesson: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      mediaAsset: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      lessonResource: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };
    service = new CoursesService(mockPrisma);
  });

  describe('1. Course Creation & Multi-Tenant Scoping', () => {
    it('should create course with auto-resolved category and default completion rules', async () => {
      mockPrisma.courseCategory.upsert.mockResolvedValue({
        id: 'cat-theology',
        name: 'Theology',
        slug: 'theology',
      });
      mockPrisma.course.findUnique.mockResolvedValue(null); // No slug collision

      const createdCourseMock = {
        id: 'crs-1',
        instituteId: 'inst-berean',
        categoryId: 'cat-theology',
        title: 'Biblical Hermeneutics',
        slug: 'biblical-hermeneutics',
        description: 'Principles of sound biblical interpretation.',
        level: CourseLevel.BEGINNER,
        language: 'English',
        pricing: PricingType.FREE,
        price: 0,
        status: CourseStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
        modules: [],
        instructors: [],
        _count: { enrolments: 0 },
      };

      mockPrisma.course.create.mockResolvedValue(createdCourseMock);
      mockPrisma.course.findFirst.mockResolvedValue(createdCourseMock);

      const result = await service.create('inst-berean', {
        title: 'Biblical Hermeneutics',
        categoryName: 'Theology',
        description: 'Principles of sound biblical interpretation.',
        level: 'BEGINNER',
        pricing: 'FREE',
      });

      expect(result.id).toBe('crs-1');
      expect(result.title).toBe('Biblical Hermeneutics');
      expect(result.slug).toBe('biblical-hermeneutics');
      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instituteId: 'inst-berean',
            title: 'Biblical Hermeneutics',
            status: CourseStatus.DRAFT,
          }),
        }),
      );
    });

    it('should BLOCK cross-tenant course access with 404 NotFound', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(service.findOne('inst-berean', 'crs-foreign')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'crs-foreign',
            instituteId: 'inst-berean',
          }),
        }),
      );
    });
  });

  describe('2. Curriculum Hierarchy: Course -> Module -> Chapter -> Lesson -> Resource', () => {
    it('should create module with calculated sequential position', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean' });
      mockPrisma.module.findFirst.mockResolvedValue({ position: 2 }); // existing last position
      mockPrisma.module.create.mockResolvedValue({
        id: 'mod-3',
        courseId: 'crs-1',
        title: 'Module 3: Epistles',
        position: 3,
        chapters: [],
      });

      const mod = await service.createModule('inst-berean', 'crs-1', {
        title: 'Module 3: Epistles',
      });

      expect(mod.title).toBe('Module 3: Epistles');
      expect(mod.position).toBe(3);
    });

    it('should create chapter under specified module', async () => {
      mockPrisma.module.findFirst.mockResolvedValue({ id: 'mod-1', courseId: 'crs-1' });
      mockPrisma.chapter.findFirst.mockResolvedValue(null); // first chapter
      mockPrisma.chapter.create.mockResolvedValue({
        id: 'ch-1',
        moduleId: 'mod-1',
        title: 'Chapter 1: Historical Context',
        position: 0,
      });

      const chapter = await service.createChapter('inst-berean', 'crs-1', 'mod-1', {
        title: 'Chapter 1: Historical Context',
      });

      expect(chapter.title).toBe('Chapter 1: Historical Context');
      expect(chapter.position).toBe(0);
    });

    it('should create lesson with video type and duration', async () => {
      mockPrisma.chapter.findFirst.mockResolvedValue({ id: 'ch-1', moduleId: 'mod-1' });
      mockPrisma.lesson.findFirst.mockResolvedValue({ position: 0 });
      mockPrisma.lesson.create.mockResolvedValue({
        id: 'les-1',
        chapterId: 'ch-1',
        title: 'Lesson 1.1: Introduction to Exegesis',
        type: LessonType.VIDEO,
        durationSec: 1800,
        isPreview: true,
        isMandatory: true,
        position: 1,
        resources: [],
      });

      const lesson = await service.createLesson('inst-berean', 'crs-1', 'ch-1', {
        title: 'Lesson 1.1: Introduction to Exegesis',
        type: 'VIDEO',
        durationSec: 1800,
        isPreview: true,
      });

      expect(lesson.title).toBe('Lesson 1.1: Introduction to Exegesis');
      expect(lesson.durationSec).toBe(1800);
      expect(lesson.isPreview).toBe(true);
    });

    it('should attach downloadable resource and link MediaAsset safely', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-1', chapterId: 'ch-1' });
      mockPrisma.mediaAsset.findUnique.mockResolvedValue(null);
      mockPrisma.mediaAsset.create.mockResolvedValue({
        id: 'asset-1',
        kind: 'PDF',
        storageKey: 'notes/hermeneutics-handout.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(2048000),
      });
      mockPrisma.lessonResource.create.mockResolvedValue({
        id: 'res-1',
        lessonId: 'les-1',
        mediaAssetId: 'asset-1',
        downloadable: true,
        createdAt: new Date(),
        mediaAsset: {
          kind: 'PDF',
          storageKey: 'notes/hermeneutics-handout.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(2048000),
        },
      });

      const resource = await service.attachResource(
        'inst-berean',
        'crs-1',
        'les-1',
        {
          kind: 'PDF',
          storageKey: 'notes/hermeneutics-handout.pdf',
          mimeType: 'application/pdf',
          sizeBytes: '2048000',
          downloadable: true,
        },
        'usr-admin',
      );

      expect(resource.kind).toBe('PDF');
      expect(resource.downloadable).toBe(true);
      expect(resource.storageKey).toBe('notes/hermeneutics-handout.pdf');
    });
  });

  describe('3. Curriculum Reordering & Teacher Assignment', () => {
    it('should reorder modules transactionally when all modules belong to course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean' });
      mockPrisma.module.findFirst.mockResolvedValue({ id: 'mod-1', courseId: 'crs-1', instituteId: 'inst-berean' });
      mockPrisma.module.update.mockResolvedValue({});

      const res = await service.reorderCurriculum('inst-berean', 'crs-1', {
        entityType: 'module',
        items: [
          { id: 'mod-2', position: 0 },
          { id: 'mod-1', position: 1 },
        ],
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.module.update).toHaveBeenCalledTimes(2);
    });

    it('should REJECT reordering with 400 BadRequest if an item belongs to another course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean' });
      mockPrisma.module.findFirst.mockResolvedValue(null); // Foreign item not found in this course

      await expect(
        service.reorderCurriculum('inst-berean', 'crs-1', {
          entityType: 'module',
          items: [{ id: 'mod-foreign', position: 0 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should assign teacher to course with role LEAD', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean' });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({
        id: 'fac-1',
        instituteId: 'inst-berean',
        membership: { user: { fullName: 'Dr. Samuel Mathew', email: 'samuel@example.com' } },
      });
      mockPrisma.courseInstructor.upsert.mockResolvedValue({
        id: 'ins-1',
        courseId: 'crs-1',
        teacherProfileId: 'fac-1',
        role: 'LEAD',
      });

      const instructor = await service.assignInstructor('inst-berean', 'crs-1', {
        teacherProfileId: 'fac-1',
        role: 'LEAD',
      });

      expect(instructor.teacherName).toBe('Dr. Samuel Mathew');
      expect(instructor.role).toBe('LEAD');
    });
  });

  describe('4. Course Content Security, Entitlements & DRM Enforcement', () => {
    beforeEach(() => {
      mockPrisma.enrolment = {
        findFirst: jest.fn(),
      };
    });

    it('should BLOCK students from accessing non-preview lesson materials without active enrolment (403)', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean', status: 'PUBLISHED' });
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-1', isPreview: false });
      mockPrisma.lessonResource.findFirst.mockResolvedValue({
        id: 'res-1',
        downloadable: true,
        mediaAsset: { storageKey: 'notes.pdf', kind: 'PDF', mimeType: 'application/pdf', sizeBytes: BigInt(1024) },
      });
      mockPrisma.enrolment.findFirst.mockResolvedValue(null); // Not enrolled

      await expect(
        service.authorizeResourceAccess(
          'inst-berean',
          'crs-1',
          'les-1',
          'res-1',
          { sub: 'student-usr-1', role: 'STUDENT', instituteId: 'inst-berean' },
          false,
        ),
      ).rejects.toThrow('You must be actively enrolled');
    });

    it('should ALLOW student access to preview lesson without active enrolment', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean', status: 'PUBLISHED' });
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-preview', isPreview: true });
      mockPrisma.lessonResource.findFirst.mockResolvedValue({
        id: 'res-1',
        downloadable: false,
        mediaAsset: { storageKey: 'preview-notes.pdf', kind: 'PDF', mimeType: 'application/pdf', sizeBytes: BigInt(1024) },
      });

      const result = await service.authorizeResourceAccess(
        'inst-berean',
        'crs-1',
        'les-preview',
        'res-1',
        { sub: 'student-usr-1', role: 'STUDENT', instituteId: 'inst-berean' },
        false,
      );

      expect(result.accessMode).toBe('INLINE_STREAM');
      expect(result.signedAccessToken).toBeDefined();
    });

    it('should ENFORCE DRM: BLOCK offline download when downloadable=false with 403 Forbidden', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean', status: 'PUBLISHED' });
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-preview', isPreview: true });
      mockPrisma.lessonResource.findFirst.mockResolvedValue({
        id: 'res-protected',
        downloadable: false, // DRM Protected
        mediaAsset: { storageKey: 'confidential-lecture.mp4', kind: 'VIDEO', mimeType: 'video/mp4', sizeBytes: BigInt(102400) },
      });

      await expect(
        service.authorizeResourceAccess(
          'inst-berean',
          'crs-1',
          'les-preview',
          'res-protected',
          { sub: 'student-usr-1', role: 'STUDENT', instituteId: 'inst-berean' },
          true, // Requested offline download
        ),
      ).rejects.toThrow('Offline download is restricted for this resource');
    });

    it('should ALLOW offline download when downloadable=true', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean', status: 'PUBLISHED' });
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-preview', isPreview: true });
      mockPrisma.lessonResource.findFirst.mockResolvedValue({
        id: 'res-open',
        downloadable: true,
        mediaAsset: { storageKey: 'open-syllabus.pdf', kind: 'PDF', mimeType: 'application/pdf', sizeBytes: BigInt(102400) },
      });

      const result = await service.authorizeResourceAccess(
        'inst-berean',
        'crs-1',
        'les-preview',
        'res-open',
        { sub: 'student-usr-1', role: 'STUDENT', instituteId: 'inst-berean' },
        true, // Requested download
      );

      expect(result.accessMode).toBe('ATTACHMENT_DOWNLOAD');
      expect(result.signedAccessToken).toBeDefined();
    });

    it('should BLOCK unassigned teacher from accessing course materials with 403 Forbidden', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean', status: 'PUBLISHED' });
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-1', isPreview: false });
      mockPrisma.lessonResource.findFirst.mockResolvedValue({
        id: 'res-1',
        downloadable: true,
        mediaAsset: { storageKey: 'notes.pdf', kind: 'PDF', mimeType: 'application/pdf', sizeBytes: BigInt(1024) },
      });
      mockPrisma.courseInstructor.findFirst.mockResolvedValue(null); // Teacher not assigned to course

      await expect(
        service.authorizeResourceAccess(
          'inst-berean',
          'crs-1',
          'les-1',
          'res-1',
          { sub: 'unassigned-teacher-id', role: 'TEACHER', instituteId: 'inst-berean' },
          false,
        ),
      ).rejects.toThrow('You are not assigned as an instructor for this course');
    });

    it('should BLOCK students from accessing DRAFT courses with 403 Forbidden', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-draft', instituteId: 'inst-berean', status: 'DRAFT' });
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'les-1', isPreview: true });
      mockPrisma.lessonResource.findFirst.mockResolvedValue({
        id: 'res-1',
        downloadable: true,
        mediaAsset: { storageKey: 'notes.pdf', kind: 'PDF', mimeType: 'application/pdf', sizeBytes: BigInt(1024) },
      });

      await expect(
        service.authorizeResourceAccess(
          'inst-berean',
          'crs-draft',
          'les-1',
          'res-1',
          { sub: 'student-usr-1', role: 'STUDENT', instituteId: 'inst-berean' },
          false,
        ),
      ).rejects.toThrow('currently in draft status');
    });
  });
});
