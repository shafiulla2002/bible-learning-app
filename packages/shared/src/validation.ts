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
  title: z.string().min(3, 'Course title is required'),
  slug: z.string().min(3, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
  language: z.string().default('English'),
  price: z.number().int().min(0, 'Price must be non-negative'), // in paise
  isFree: z.boolean().default(false),
  leadTeacherId: z.string().optional(),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
