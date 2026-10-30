import { z } from 'zod';

export const PhoneLoginSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format (e.g. +919876543210)'),
  otp: z.string().length(6, 'OTP must be 6 digits').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export type PhoneLoginInput = z.infer<typeof PhoneLoginSchema>;

export const StudentRegistrationSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phoneNumber: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  church: z.string().optional(),
  preferredLanguage: z.string().default('English'),
  statementOfInterest: z.string().max(1000).optional(),
});

export type StudentRegistrationInput = z.infer<typeof StudentRegistrationSchema>;

export const StudentStatusEnum = z.enum([
  'APPLIED',
  'UNDER_REVIEW',
  'APPROVED',
  'ACTIVE',
  'INACTIVE',
  'REJECTED',
  'COMPLETED',
]);

export type StudentStatusType = z.infer<typeof StudentStatusEnum>;

export const CreateStudentAdmissionSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phoneNumber: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format (e.g. +919876543210)'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  admissionDate: z.string().optional(), // YYYY-MM-DD
  preferredLanguage: z.string().default('English'),
  church: z.string().optional(),
  educationLevel: z.string().optional(),
  emergencyContact: z.string().optional(),

  // Address
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().default('India'),
      postalCode: z.string().optional(),
    })
    .optional(),

  // Guardian
  guardian: z
    .object({
      name: z.string().optional(),
      relation: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),

  // Enrolment & Admission
  courseId: z.string().optional(),
  batchId: z.string().optional(),
  status: StudentStatusEnum.default('ACTIVE'),
  statement: z.string().optional(),
});

export type CreateStudentAdmissionInput = z.infer<typeof CreateStudentAdmissionSchema>;

export const UpdateStudentProfileSchema = CreateStudentAdmissionSchema.partial();
export type UpdateStudentProfileInput = z.infer<typeof UpdateStudentProfileSchema>;

export const UpdateStudentStatusSchema = z.object({
  status: StudentStatusEnum,
  notes: z.string().optional(),
});
export type UpdateStudentStatusInput = z.infer<typeof UpdateStudentStatusSchema>;

export const StudentFilterQuerySchema = z.object({
  search: z.string().optional(),
  courseId: z.string().optional(),
  batchId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['fullName', 'admissionNo', 'createdAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type StudentFilterQuery = z.infer<typeof StudentFilterQuerySchema>;

export const BulkStudentImportRowSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phoneNumber: z.string().min(10, 'Valid phone number required'),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.string().optional(),
  admissionNo: z.string().optional(),
  courseName: z.string().optional(),
  church: z.string().optional(),
  preferredLanguage: z.string().default('English'),
});

export type BulkStudentImportRow = z.infer<typeof BulkStudentImportRowSchema>;

export const CreateCourseSchema = z.object({
  title: z.string().min(3, 'Course title must be at least 3 characters'),
  slug: z
    .string()
    .min(3, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
  language: z.string().default('English'),
  pricing: z.enum(['FREE', 'PAID']).default('FREE'),
  price: z.coerce.number().int().min(0, 'Price must be non-negative').default(0), // in paise
  salePrice: z.coerce.number().int().min(0).optional(),
  accessDays: z.coerce.number().int().min(1).optional(),
  coverImage: z.string().url().optional().or(z.literal('')),
  leadTeacherId: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = CreateCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

export const CourseFilterQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'price']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CourseFilterQuery = z.infer<typeof CourseFilterQuerySchema>;

export const CreateModuleSchema = z.object({
  title: z.string().min(2, 'Module title is required'),
  position: z.number().int().min(0).optional(),
});
export type CreateModuleInput = z.infer<typeof CreateModuleSchema>;

export const UpdateModuleSchema = z.object({
  title: z.string().min(2).optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateModuleInput = z.infer<typeof UpdateModuleSchema>;

export const CreateChapterSchema = z.object({
  title: z.string().min(2, 'Chapter title is required'),
  position: z.number().int().min(0).optional(),
});
export type CreateChapterInput = z.infer<typeof CreateChapterSchema>;

export const UpdateChapterSchema = z.object({
  title: z.string().min(2).optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateChapterInput = z.infer<typeof UpdateChapterSchema>;

export const CreateLessonSchema = z.object({
  title: z.string().min(2, 'Lesson title is required'),
  type: z.enum(['VIDEO', 'PDF', 'AUDIO', 'TEXT', 'QUIZ', 'LIVE']).default('VIDEO'),
  body: z.string().optional(),
  durationSec: z.number().int().min(0).default(0),
  isPreview: z.boolean().default(false),
  isMandatory: z.boolean().default(true),
  position: z.number().int().min(0).optional(),
});
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;

export const UpdateLessonSchema = CreateLessonSchema.partial();
export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;

export const CreateResourceSchema = z.object({
  kind: z.enum(['VIDEO', 'PDF', 'AUDIO', 'IMAGE', 'FILE']).default('PDF'),
  storageKey: z.string().min(1, 'Storage key or file path is required'),
  mimeType: z.string().default('application/pdf'),
  sizeBytes: z.coerce.string().default('1024000'),
  downloadable: z.boolean().default(false),
});
export type CreateResourceInput = z.infer<typeof CreateResourceSchema>;

export const AssignCourseInstructorSchema = z.object({
  teacherProfileId: z.string().min(1, 'Teacher selection is required'),
  role: z.enum(['LEAD', 'ASSISTANT']).default('LEAD'),
});
export type AssignCourseInstructorInput = z.infer<typeof AssignCourseInstructorSchema>;

export const ReorderCurriculumSchema = z.object({
  entityType: z.enum(['module', 'chapter', 'lesson']),
  items: z.array(
    z.object({
      id: z.string(),
      position: z.number().int().min(0),
    }),
  ),
});
export type ReorderCurriculumInput = z.infer<typeof ReorderCurriculumSchema>;

// ----------------------------------------------------
// MILESTONE 2.3: BATCHES, ACADEMIC TERMS & SCHEDULING
// ----------------------------------------------------

export const CreateAcademicYearSchema = z.object({
  name: z.string().min(2, 'Academic year name is required (e.g. 2026-2027)'),
  startDate: z.string().min(10, 'Start date is required (YYYY-MM-DD)'),
  endDate: z.string().min(10, 'End date is required (YYYY-MM-DD)'),
  isCurrent: z.boolean().default(false),
});
export type CreateAcademicYearInput = z.infer<typeof CreateAcademicYearSchema>;

export const UpdateAcademicYearSchema = CreateAcademicYearSchema.partial();
export type UpdateAcademicYearInput = z.infer<typeof UpdateAcademicYearSchema>;

export const CreateAcademicTermSchema = z.object({
  academicYearId: z.string().min(1, 'Academic year is required'),
  name: z.string().min(2, 'Term name is required (e.g. Fall 2026 / Semester 1)'),
  startDate: z.string().min(10, 'Start date is required (YYYY-MM-DD)'),
  endDate: z.string().min(10, 'End date is required (YYYY-MM-DD)'),
  isCurrent: z.boolean().default(false),
});
export type CreateAcademicTermInput = z.infer<typeof CreateAcademicTermSchema>;

export const UpdateAcademicTermSchema = CreateAcademicTermSchema.partial();
export type UpdateAcademicTermInput = z.infer<typeof UpdateAcademicTermSchema>;

export const BatchStatusEnum = z.enum([
  'UPCOMING',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export const CreateBatchSchema = z.object({
  courseId: z.string().min(1, 'Course selection is required'),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  name: z.string().min(2, 'Batch name is required (e.g. Cohort Alpha 2026)'),
  code: z.string().optional(),
  startDate: z.string().min(10, 'Start date is required (YYYY-MM-DD)'),
  endDate: z.string().min(10, 'End date is required (YYYY-MM-DD)'),
  capacity: z.coerce.number().int().min(1, 'Batch capacity must be at least 1').default(50),
  status: BatchStatusEnum.default('ACTIVE'),
  leadTeacherProfileId: z.string().optional(),
  assistantTeacherProfileIds: z.array(z.string()).optional(),
});
export type CreateBatchInput = z.infer<typeof CreateBatchSchema>;

export const UpdateBatchSchema = CreateBatchSchema.partial();
export type UpdateBatchInput = z.infer<typeof UpdateBatchSchema>;

export const BatchFilterQuerySchema = z.object({
  courseId: z.string().optional(),
  termId: z.string().optional(),
  academicYearId: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type BatchFilterQuery = z.infer<typeof BatchFilterQuerySchema>;

export const AssignBatchTeacherSchema = z.object({
  teacherProfileId: z.string().min(1, 'Teacher selection is required'),
  role: z.enum(['LEAD', 'ASSISTANT']).default('LEAD'),
});
export type AssignBatchTeacherInput = z.infer<typeof AssignBatchTeacherSchema>;

export const EnrollStudentBatchSchema = z.object({
  studentProfileId: z.string().min(1, 'Student selection is required'),
});
export type EnrollStudentBatchInput = z.infer<typeof EnrollStudentBatchSchema>;

export const TransferStudentBatchSchema = z.object({
  studentProfileId: z.string().min(1, 'Student selection is required'),
  sourceBatchId: z.string().min(1, 'Source batch is required'),
  targetBatchId: z.string().min(1, 'Target batch is required'),
  reason: z.string().min(3, 'Transfer reason is required'),
});
export type TransferStudentBatchInput = z.infer<typeof TransferStudentBatchSchema>;

export const CreateClassScheduleSchema = z.object({
  batchId: z.string().min(1, 'Batch is required'),
  teacherProfileId: z.string().min(1, 'Teacher is required'),
  title: z.string().min(2, 'Class title is required'),
  description: z.string().optional(),
  room: z.string().optional(),
  startsAt: z.string().min(10, 'Start time is required (ISO 8601)'),
  endsAt: z.string().min(10, 'End time is required (ISO 8601)'),
  joinUrl: z.string().url().optional().or(z.literal('')),
  recordingUrl: z.string().url().optional().or(z.literal('')),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
});
export type CreateClassScheduleInput = z.infer<typeof CreateClassScheduleSchema>;

export const CheckScheduleConflictSchema = z.object({
  batchId: z.string().optional(),
  teacherProfileId: z.string().optional(),
  room: z.string().optional(),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  excludeSessionId: z.string().optional(),
});
export type CheckScheduleConflictInput = z.infer<typeof CheckScheduleConflictSchema>;

export const RecurringWeeklyScheduleSchema = z.object({
  batchId: z.string().min(1, 'Batch is required'),
  teacherProfileId: z.string().min(1, 'Teacher is required'),
  title: z.string().min(2, 'Class title is required'),
  description: z.string().optional(),
  room: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day must be selected'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be HH:mm'),
  startDate: z.string().min(10, 'Start date is required (YYYY-MM-DD)'),
  endDate: z.string().min(10, 'End date is required (YYYY-MM-DD)'),
  exceptions: z.array(z.string()).optional(),
  joinUrl: z.string().url().optional().or(z.literal('')),
});
export type RecurringWeeklyScheduleInput = z.infer<typeof RecurringWeeklyScheduleSchema>;

// -----------------------------------------------------------------------------
// ATTENDANCE MANAGEMENT VALIDATION (Milestone 2.4)
// -----------------------------------------------------------------------------

export const AttendanceStatusEnum = z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']);
export type AttendanceStatusType = z.infer<typeof AttendanceStatusEnum>;

export const AttendanceModeEnum = z.enum(['DAILY_BATCH', 'LIVE_SESSION']);
export type AttendanceModeType = z.infer<typeof AttendanceModeEnum>;

export const MarkAttendanceRecordSchema = z.object({
  studentProfileId: z.string().min(1, 'Student selection is required'),
  status: AttendanceStatusEnum,
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters').optional().nullable(),
});
export type MarkAttendanceRecordInput = z.infer<typeof MarkAttendanceRecordSchema>;

export const MarkBulkAttendanceSchema = z.object({
  batchId: z.string().min(1, 'Batch selection is required'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  mode: AttendanceModeEnum.default('DAILY_BATCH'),
  liveSessionId: z.string().optional().nullable(),
  records: z
    .array(MarkAttendanceRecordSchema)
    .min(1, 'At least one student attendance record is required'),
});
export type MarkBulkAttendanceInput = z.infer<typeof MarkBulkAttendanceSchema>;

export const UpdateIndividualAttendanceSchema = z.object({
  status: AttendanceStatusEnum,
  remarks: z.string().max(500, 'Remarks cannot exceed 500 characters').optional().nullable(),
});
export type UpdateIndividualAttendanceInput = z.infer<typeof UpdateIndividualAttendanceSchema>;

export const AttendanceFilterQuerySchema = z.object({
  batchId: z.string().optional(),
  studentProfileId: z.string().optional(),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  courseId: z.string().optional(),
  mode: AttendanceModeEnum.optional(),
  status: AttendanceStatusEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AttendanceFilterQueryInput = z.infer<typeof AttendanceFilterQuerySchema>;


