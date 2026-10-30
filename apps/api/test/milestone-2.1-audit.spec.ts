import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InstituteTenantGuard } from '../src/core/auth/guards/institute-tenant.guard';
import { StudentsService } from '../src/modules/students/students.service';
import { Role } from '@prisma/client';

describe('Milestone 2.1 — Final Quality & Security Audit', () => {
  describe('1. Multi-Tenant Security Audit', () => {
    let guard: InstituteTenantGuard;

    beforeEach(() => {
      guard = new InstituteTenantGuard();
    });

    it('should allow access when user instituteId matches route instituteId', () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { sub: 'usr-1', role: 'INSTITUTE_ADMIN', instituteId: 'inst-berean' },
            params: { instituteId: 'inst-berean' },
          }),
        }),
      };

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should BLOCK cross-tenant access with 403 Forbidden when instituteId does not match', () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { sub: 'usr-1', role: 'INSTITUTE_ADMIN', instituteId: 'inst-berean' },
            params: { instituteId: 'inst-other-seminary' },
          }),
        }),
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow SUPER_ADMIN cross-tenant oversight access', () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { sub: 'super-1', role: 'SUPER_ADMIN', instituteId: 'inst-platform' },
            params: { instituteId: 'inst-other-seminary' },
          }),
        }),
      };

      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('2. Student Isolation & Cross-Tenant Boundary Tests in StudentsService', () => {
    let service: StudentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        studentProfile: {
          findFirst: jest.fn(),
          count: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        institute: {
          findUnique: jest.fn(),
        },
        membership: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        course: {
          findFirst: jest.fn(),
        },
        batch: {
          findFirst: jest.fn(),
        },
        enrolment: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        admission: {
          create: jest.fn(),
        },
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      };
      service = new StudentsService(mockPrisma);
    });

    it('should throw NotFoundException (404) when attempting to access a student from another institute', async () => {
      // Mock returns null because tenant instituteId does not match
      mockPrisma.studentProfile.findFirst.mockResolvedValue(null);

      await expect(service.findOne('inst-berean', 'student-from-other-inst')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.studentProfile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'student-from-other-inst',
            instituteId: 'inst-berean',
          }),
        }),
      );
    });

    it('should reject enrollment if course belongs to another institute', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: 'stu-1', instituteId: 'inst-berean' });
      mockPrisma.course.findFirst.mockResolvedValue(null); // Course not found in this institute

      await expect(
        service.enrollStudent('inst-berean', 'stu-1', 'course-other-inst'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject enrollment if batch belongs to another institute or different course', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: 'stu-1', instituteId: 'inst-berean' });
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-1', instituteId: 'inst-berean', status: 'PUBLISHED' });
      mockPrisma.batch.findFirst.mockResolvedValue(null); // Batch not found for this inst + course

      await expect(
        service.enrollStudent('inst-berean', 'stu-1', 'crs-1', 'batch-foreign'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject enrollment if course is ARCHIVED with 400 BadRequest', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({ id: 'stu-1', instituteId: 'inst-berean' });
      mockPrisma.course.findFirst.mockResolvedValue({ id: 'crs-archived', instituteId: 'inst-berean', status: 'ARCHIVED' });

      await expect(
        service.enrollStudent('inst-berean', 'stu-1', 'crs-archived'),
      ).rejects.toThrow('Archived courses cannot receive new enrolments');
    });
  });

  describe('3. Student Admission & Integrity Audit', () => {
    let service: StudentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        institute: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inst-1', status: 'ACTIVE' }),
        },
        membership: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'mem-1' }),
        },
        studentProfile: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation((args) => ({
            id: 'stu-new',
            ...args.data,
            createdAt: new Date(),
          })),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'usr-new',
            phoneE164: '+919876543210',
            fullName: 'Audit Student',
          }),
        },
        admission: {
          create: jest.fn().mockResolvedValue({ id: 'adm-1' }),
        },
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      };
      service = new StudentsService(mockPrisma);
    });

    it('should reject duplicate phone in the same institute with 409 Conflict', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: 'existing-mem',
        studentProfile: { admissionNo: 'ADM-2026-0001' },
      });

      await expect(
        service.createStudent('inst-1', {
          fullName: 'Duplicate Tester',
          phoneNumber: '+919876543210',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully create student atomically and generate sequential admission number', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue(null);
      mockPrisma.studentProfile.findFirst.mockResolvedValue({ admissionNo: 'ADM-2026-0005' });

      const result = await service.createStudent('inst-1', {
        fullName: 'Audit Student',
        phoneNumber: '+919876543210',
      });

      expect(result.fullName).toBe('Audit Student');
      expect(result.admissionNo).toBe('ADM-2026-0006');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.studentProfile.create).toHaveBeenCalled();
      expect(mockPrisma.admission.create).toHaveBeenCalled();
    });
  });

  describe('4. CSV Import Audit', () => {
    let service: StudentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        membership: {
          findFirst: jest.fn(),
        },
        course: {
          findFirst: jest.fn(),
        },
      };
      service = new StudentsService(mockPrisma);
    });

    it('should catch invalid rows with missing full name and malformed phone', async () => {
      const invalidRows: any[] = [
        { fullName: '', phoneNumber: '+919876543210' }, // Missing name
        { fullName: 'Valid Name', phoneNumber: '123' }, // Invalid short phone
      ];

      const res = await service.processBulkImport('inst-1', invalidRows, false);

      expect(res.totalRows).toBe(2);
      expect(res.validRows).toBe(0);
      expect(res.invalidRows).toBe(2);
      expect(res.errors.length).toBe(2);
    });

    it('should detect duplicate phone numbers within the uploaded CSV file', async () => {
      const duplicateRows: any[] = [
        { fullName: 'Student One', phoneNumber: '+919999999999' },
        { fullName: 'Student Two', phoneNumber: '+919999999999' }, // duplicate
      ];

      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const res = await service.processBulkImport('inst-1', duplicateRows, false);

      expect(res.totalRows).toBe(2);
      expect(res.validRows).toBe(1);
      expect(res.invalidRows).toBe(1);
      expect(res.duplicates).toBe(1);
    });

    it('should detect phone already existing in this institute', async () => {
      const rows: any[] = [
        { fullName: 'Existing Student', phoneNumber: '+919888888888' },
      ];

      mockPrisma.membership.findFirst.mockResolvedValue({ id: 'mem-existing' });

      const res = await service.processBulkImport('inst-1', rows, false);

      expect(res.totalRows).toBe(1);
      expect(res.validRows).toBe(0);
      expect(res.duplicates).toBe(1);
      expect(res.errors[0].error).toContain('already registered in this institute');
    });

    it('should reject row if specified courseName is not found in this institute', async () => {
      const rows: any[] = [
        { fullName: 'Course Student', phoneNumber: '+919777777777', courseName: 'Fake Course' },
      ];

      mockPrisma.membership.findFirst.mockResolvedValue(null);
      mockPrisma.course.findFirst.mockResolvedValue(null); // not found in institute

      const res = await service.processBulkImport('inst-1', rows, false);

      expect(res.totalRows).toBe(1);
      expect(res.validRows).toBe(0);
      expect(res.invalidRows).toBe(1);
      expect(res.errors[0].error).toContain('not found in this institute');
    });
  });
});
