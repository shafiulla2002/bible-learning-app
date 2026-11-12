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
    .transform((val) => val.trim().replace(/[\s\-()]/g, ''))
    .refine((val) => /^\+?[1-9]\d{7,14}$/.test(val), {
      message: 'Invalid phone number format (e.g. +919876543210)',
    }),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gender: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['MALE', 'FEMALE', 'OTHER']),
    )
    .optional(),
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
  courseType: z.enum(['SELF_PACED', 'COHORT', 'LIVE', 'DIPLOMA', 'CERTIFICATE']).default('COHORT'),
  learningMode: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).default('ONLINE'),
  durationLabel: z.string().max(120).optional(),
  eligibility: z.string().max(1000).optional(),
  language: z.string().default('English'),
  pricing: z.enum(['FREE', 'PAID']).default('FREE'),
  price: z.coerce.number().int().min(0, 'Price must be non-negative').default(0), // in paise
  salePrice: z.coerce.number().int().min(0).optional(),
  registrationFee: z.coerce.number().int().min(0, 'Registration fee must be non-negative').default(0), // in paise
  accessDays: z.coerce.number().int().min(1).optional(),
  enrollmentStartsAt: z.string().optional().or(z.literal('')),
  enrollmentEndsAt: z.string().optional().or(z.literal('')),
  requiresApproval: z.boolean().default(true),
  coverImage: z.string().url().optional().or(z.literal('')),
  leadTeacherId: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = CreateCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

export const CreateCourseCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});
export type CreateCourseCategoryInput = z.infer<typeof CreateCourseCategorySchema>;

export const UpdateCourseCategorySchema = CreateCourseCategorySchema.partial();
export type UpdateCourseCategoryInput = z.infer<typeof UpdateCourseCategorySchema>;

export const UpsertCompletionRuleSchema = z.object({
  minProgressPct: z.coerce.number().int().min(0).max(100).default(100),
  allMandatory: z.boolean().default(true),
  minExamPct: z.coerce.number().int().min(0).max(100).default(60),
  minAttendancePct: z.coerce.number().int().min(0).max(100).default(75),
});
export type UpsertCompletionRuleInput = z.infer<typeof UpsertCompletionRuleSchema>;

export const UpdateResourceSchema = z.object({
  downloadable: z.boolean().optional(),
  kind: z.enum(['VIDEO', 'PDF', 'AUDIO', 'IMAGE', 'FILE']).optional(),
});
export type UpdateResourceInput = z.infer<typeof UpdateResourceSchema>;

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

// -----------------------------------------------------------------------------
// TEACHER MANAGEMENT VALIDATION SCHEMAS (Milestone 2.6)
// -----------------------------------------------------------------------------

export const TeacherStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']);
export type TeacherStatusType = z.infer<typeof TeacherStatusEnum>;

export const InstructorRoleEnum = z.enum(['LEAD', 'ASSISTANT']);
export type InstructorRoleType = z.infer<typeof InstructorRoleEnum>;

export const TeacherAddressSchema = z.object({
  street: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});
export type TeacherAddressInput = z.infer<typeof TeacherAddressSchema>;

export const CreateTeacherSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name cannot exceed 100 characters'),
  phoneE164: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be valid E.164 format (e.g. +919876543210)'),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  employeeCode: z.string().trim().max(50, 'Employee code cannot exceed 50 characters').optional().nullable().or(z.literal('')),
  qualifications: z.string().trim().max(255, 'Qualifications cannot exceed 255 characters').optional().nullable().or(z.literal('')),
  specialization: z.string().trim().max(255, 'Specialization cannot exceed 255 characters').optional().nullable().or(z.literal('')),
  experienceYears: z.coerce.number().int().min(0, 'Experience cannot be negative').max(60, 'Experience cannot exceed 60 years').optional().nullable(),
  joiningDate: z.string().optional().nullable().or(z.literal('')),
  address: TeacherAddressSchema.optional().nullable(),
  bio: z.string().max(2000, 'Bio cannot exceed 2000 characters').optional().nullable().or(z.literal('')),
  photoUrl: z.string().url('Invalid photo URL').optional().nullable().or(z.literal('')),
  status: TeacherStatusEnum.default('ACTIVE'),
});
export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;

export const UpdateTeacherProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name cannot exceed 100 characters').optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  employeeCode: z.string().trim().max(50, 'Employee code cannot exceed 50 characters').optional().nullable().or(z.literal('')),
  qualifications: z.string().trim().max(255, 'Qualifications cannot exceed 255 characters').optional().nullable().or(z.literal('')),
  specialization: z.string().trim().max(255, 'Specialization cannot exceed 255 characters').optional().nullable().or(z.literal('')),
  experienceYears: z.coerce.number().int().min(0, 'Experience cannot be negative').max(60, 'Experience cannot exceed 60 years').optional().nullable(),
  joiningDate: z.string().optional().nullable().or(z.literal('')),
  address: TeacherAddressSchema.optional().nullable(),
  bio: z.string().max(2000, 'Bio cannot exceed 2000 characters').optional().nullable().or(z.literal('')),
  photoUrl: z.string().url('Invalid photo URL').optional().nullable().or(z.literal('')),
});
export type UpdateTeacherProfileInput = z.infer<typeof UpdateTeacherProfileSchema>;

export const UpdateTeacherStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
  reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional().nullable(),
});
export type UpdateTeacherStatusInput = z.infer<typeof UpdateTeacherStatusSchema>;

export const TeacherFilterQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'ALL']).optional(),
  specialization: z.string().optional(),
  courseId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type TeacherFilterQueryInput = z.infer<typeof TeacherFilterQuerySchema>;

export const AssignTeacherCourseSchema = z.object({
  courseId: z.string().min(1, 'Course selection is required'),
  role: InstructorRoleEnum.default('LEAD'),
});
export type AssignTeacherCourseInput = z.infer<typeof AssignTeacherCourseSchema>;

export const AssignTeacherBatchSchema = z.object({
  batchId: z.string().min(1, 'Batch selection is required'),
  role: InstructorRoleEnum.default('LEAD'),
});
export type AssignTeacherBatchInput = z.infer<typeof AssignTeacherBatchSchema>;

// -----------------------------------------------------------------------------
// PUBLIC ENROLLMENT, ADMISSIONS & CHECKOUT SCHEMAS (Phases 3, 4, 5, 9, 11)
// -----------------------------------------------------------------------------

export const PublicCourseCatalogQuerySchema = z.object({
  instituteSlug: z.string().optional(),
  instituteId: z.string().optional(),
  category: z.string().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  courseType: z.enum(['SELF_PACED', 'COHORT', 'LIVE', 'DIPLOMA', 'CERTIFICATE']).optional(),
  pricing: z.enum(['FREE', 'PAID']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});
export type PublicCourseCatalogQuery = z.infer<typeof PublicCourseCatalogQuerySchema>;

export const PublicStudentRegisterSchema = z.object({
  instituteSlug: z.string().optional(),
  instituteId: z.string().optional(),
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be E.164 format (e.g. +919876543210)'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  church: z.string().trim().max(150).optional(),
  preferredLanguage: z.string().trim().max(50).default('English'),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
});
export type PublicStudentRegisterInput = z.infer<typeof PublicStudentRegisterSchema>;

export const PublicSubmitApplicationSchema = z.object({
  instituteSlug: z.string().optional(),
  instituteId: z.string().optional(),
  courseId: z.string().min(1, 'Course selection is required'),
  batchId: z.string().optional(),
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be E.164 format (e.g. +919876543210)'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  church: z.string().trim().max(150).optional(),
  preferredLanguage: z.string().trim().max(50).default('English'),
  educationLevel: z.string().trim().max(150).optional(),
  statement: z.string().trim().max(2000).optional(),
  applicantDetails: z.record(z.any()).optional(),
  documents: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        url: z.string().min(1).max(500),
      }),
    )
    .max(10)
    .optional(),
  couponCode: z.string().trim().max(40).optional(),
});
export type PublicSubmitApplicationInput = z.infer<typeof PublicSubmitApplicationSchema>;

export const ReviewAdmissionSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'INTERVIEW_SCHEDULED']),
  interviewAt: z.string().optional().nullable(),
  interviewNotes: z.string().max(1500).optional().nullable(),
});
export type ReviewAdmissionInput = z.infer<typeof ReviewAdmissionSchema>;

export const ApproveAdmissionSchema = z.object({
  batchId: z.string().optional().nullable(),
  source: z.enum(['PURCHASE', 'FREE', 'ADMIN', 'SCHOLARSHIP']).default('ADMIN'),
  notes: z.string().max(1000).optional(),
  createFeeInvoice: z.boolean().default(true),
  dueDays: z.coerce.number().int().min(0).max(365).default(14),
});
export type ApproveAdmissionInput = z.infer<typeof ApproveAdmissionSchema>;

export const RejectAdmissionSchema = z.object({
  reason: z.string().trim().min(3, 'Rejection reason must be at least 3 characters').max(1000),
});
export type RejectAdmissionInput = z.infer<typeof RejectAdmissionSchema>;

export const PublicCreateOrderSchema = z.object({
  instituteId: z.string().optional(),
  instituteSlug: z.string().optional(),
  courseIds: z.array(z.string().min(1)).min(1, 'At least one course is required').max(20),
  couponCode: z.string().trim().max(40).optional(),
  admissionId: z.string().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{6,14}$/).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
});
export type PublicCreateOrderInput = z.infer<typeof PublicCreateOrderSchema>;

export const VerifyRazorpayPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required'),
  method: z.string().optional(),
});
export type VerifyRazorpayPaymentInput = z.infer<typeof VerifyRazorpayPaymentSchema>;

export const CreatePlanSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/, 'Plan code must be uppercase alphanumeric'),
  name: z.string().trim().min(2).max(100),
  priceMonthly: z.coerce.number().int().min(0),
  priceYearly: z.coerce.number().int().min(0),
  trialDays: z.coerce.number().int().min(0).max(90).default(14),
  maxStudents: z.coerce.number().int().min(1).default(100),
  maxTeachers: z.coerce.number().int().min(1).default(10),
  maxCourses: z.coerce.number().int().min(1).default(20),
  storageGb: z.coerce.number().int().min(1).default(10),
  features: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
});
export type CreatePlanInput = z.infer<typeof CreatePlanSchema>;

// ==========================================
// PHASE 9: FINANCE, FEES & GATEWAY SCHEMAS
// ==========================================

export const CreateFeeCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
});
export type CreateFeeCategoryInput = z.infer<typeof CreateFeeCategorySchema>;

export const CreateFeeStructureSchema = z.object({
  feeCategoryId: z.string().uuid().optional(),
  categoryName: z.string().trim().min(2).max(100).optional(),
  academicYearId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40).optional(),
  periodType: z.enum(['ONE_TIME', 'MONTHLY', 'TERM', 'SEMESTER', 'ANNUAL']).default('ONE_TIME'),
  amountPaise: z.coerce.number().int().positive().optional(),
  amountInRupees: z.coerce.number().positive().optional(),
  currency: z.string().trim().min(3).max(6).default('INR'),
  description: z.string().trim().max(1000).optional(),
});
export type CreateFeeStructureInput = z.infer<typeof CreateFeeStructureSchema>;

export const AllocateStudentFeeSchema = z.object({
  studentProfileId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  academicYearId: z.string().uuid().optional(),
  academicTermId: z.string().uuid().optional(),
  billingPeriod: z.string().trim().min(2).max(60),
  customAmountPaise: z.coerce.number().int().min(0).optional(),
  remarks: z.string().trim().max(500).optional(),
});
export type AllocateStudentFeeInput = z.infer<typeof AllocateStudentFeeSchema>;

export const GenerateInvoiceSchema = z.object({
  studentProfileId: z.string().uuid(),
  feeStructureId: z.string().uuid().optional(),
  studentFeeAllocationId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  installments: z
    .array(
      z.object({
        dueDate: z.string(),
        amountPaise: z.coerce.number().int().positive(),
      }),
    )
    .optional(),
});
export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;

export const RecordFeePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  installmentId: z.string().uuid().optional(),
  amountPaise: z.coerce.number().int().positive().optional(),
  amountInRupees: z.coerce.number().positive().optional(),
  paymentMode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'DD', 'ONLINE', 'CARD']).default('ONLINE'),
  referenceNumber: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(500).optional(),
});
export type RecordFeePaymentInput = z.infer<typeof RecordFeePaymentSchema>;

export const ReversePaymentSchema = z.object({
  reversedAmountPaise: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().min(3, 'Reversal reason must be at least 3 characters').max(500),
});
export type ReversePaymentInput = z.infer<typeof ReversePaymentSchema>;

export const UpdateRazorpaySettingsSchema = z.object({
  keyId: z.string().trim().min(8).max(120).regex(/^rzp_(test|live)_/, 'Key ID must start with rzp_test_ or rzp_live_'),
  keySecret: z.string().trim().min(8).max(200),
  webhookSecret: z.string().trim().max(200).optional(),
});
export type UpdateRazorpaySettingsInput = z.infer<typeof UpdateRazorpaySettingsSchema>;




