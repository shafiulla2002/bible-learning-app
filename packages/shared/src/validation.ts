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
  password: z.string().min(6, 'Password must be at least 6 characters'),
  church: z.string().optional(),
  preferredLanguage: z.string().default('English'),
  statementOfInterest: z.string().max(1000).optional(),
});

export type StudentRegistrationInput = z.infer<typeof StudentRegistrationSchema>;

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
