/**
 * Wonder Woman Fitness - Type Definitions & Zod Schemas
 *
 * This file contains all Zod validation schemas and TypeScript types.
 * Client and server use the SAME schemas for validation consistency.
 */

import { z } from 'zod';
import {
  MIN_PASSWORD_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  MAX_DEPART_REASON_LENGTH,
  MAX_WORKOUT_TITLE_LENGTH,
  MAX_WORKOUT_DETAILS_LENGTH,
  MAX_PRIVATE_SESSION_NOTES_LENGTH,
  MAX_PRIVATE_SESSION_EXERCISE_LENGTH,
} from '@/lib/constants';

// ===== AUTHENTICATION SCHEMAS =====

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .regex(
      /(?=.*[0-9])(?=.*[!@#$%^&*])/,
      'Password must contain at least one number and one special character'
    ),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
}).strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
}).strict();

export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
}).strict();

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
}).strict();

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ===== PAYMENT SCHEMAS =====

export const PaymentSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  amount: z.number().positive('Amount must be positive'),
  paidAt: z.string().datetime('Invalid date format'),
  periodStart: z.string().date('Invalid date format'),
  periodEnd: z.string().date('Invalid date format'),
  notes: z.string().optional(),
}).strict();

export type PaymentInput = z.infer<typeof PaymentSchema>;

// ===== SESSION/WORKOUT SCHEMAS =====

export const WorkoutSchema = z.object({
  title: z.string().max(MAX_WORKOUT_TITLE_LENGTH, `Title too long (max ${MAX_WORKOUT_TITLE_LENGTH} chars)`).optional(),
  details: z.string().max(MAX_WORKOUT_DETAILS_LENGTH, `Details too long (max ${MAX_WORKOUT_DETAILS_LENGTH} chars)`).optional(),
}).strict();

export type WorkoutInput = z.infer<typeof WorkoutSchema>;

export const SessionCreateSchema = z.object({
  recurringSlotId: z.string().cuid('Invalid slot ID'),
  weekDate: z.string().date('Invalid date format'),
}).strict();

export type SessionCreateInput = z.infer<typeof SessionCreateSchema>;

export const OneOffSessionCreateSchema = z.object({
  customDay: z.number().int().min(1).max(7, 'Day of week must be 1-7'),
  customStartHour: z.number().int().min(7).max(22, 'Start hour must be 7-22'),
  weekDate: z.string().date('Invalid date format'),
}).strict();

export type OneOffSessionCreateInput = z.infer<typeof OneOffSessionCreateSchema>;

// ===== VOTE SCHEMA =====

export const VoteSchema = z.object({
  sessionId: z.string().cuid('Invalid session ID'),
  attending: z.boolean(),
}).strict();

export type VoteInput = z.infer<typeof VoteSchema>;

// ===== SESSION ASSIGNMENT SCHEMAS =====

export const SessionTrainerAssignmentSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  action: z.enum(['add', 'remove']),
}).strict();

export type SessionTrainerAssignmentInput = z.infer<typeof SessionTrainerAssignmentSchema>;

export const SessionMemberAssignmentSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  action: z.enum(['add', 'remove']),
}).strict();

export type SessionMemberAssignmentInput = z.infer<typeof SessionMemberAssignmentSchema>;

// ===== MEMBER SCHEMAS =====

export const MemberUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(MAX_NAME_LENGTH, `Name too long (max ${MAX_NAME_LENGTH} chars)`).optional(),
  phone: z.string().min(1, 'Phone is required').max(MAX_PHONE_LENGTH, `Phone too long (max ${MAX_PHONE_LENGTH} chars)`).optional(),
  email: z.string().email('Invalid email address').optional(),
}).strict();

export type MemberUpdateInput = z.infer<typeof MemberUpdateSchema>;

export const DepartureSchema = z.object({
  reason: z.string().max(MAX_DEPART_REASON_LENGTH, `Reason too long (max ${MAX_DEPART_REASON_LENGTH} chars)`).optional(),
}).strict();

export type DepartureInput = z.infer<typeof DepartureSchema>;

// ===== PRIVATE SESSION SCHEMA =====

export const PrivateSessionSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  scheduledAt: z.string().datetime('Invalid date format'),
  paid: z.boolean().default(false),
  amount: z.number().positive('Amount must be positive').optional(),
  exerciseDetails: z.string().max(MAX_PRIVATE_SESSION_EXERCISE_LENGTH, `Exercise details too long`).optional(),
  notes: z.string().max(MAX_PRIVATE_SESSION_NOTES_LENGTH, `Notes too long`).optional(),
  trainerId: z.string().cuid('Invalid trainer ID').optional(),
}).strict();

export type PrivateSessionInput = z.infer<typeof PrivateSessionSchema>;

// ===== NOTIFICATION SCHEMA =====

export const NotificationCreateSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  type: z.enum([
    'WORKOUT_POSTED',
    'VOTING_OPENED',
    'CLASS_CANCELLED',
    'MEMBER_MOVED',
    'PAYMENT_REMINDER',
    'LOCKOUT',
    'MEMBER_DEPARTED',
    'REJOIN_REQUEST',
    'TRIAL_EXPIRING',
    'TRIAL_EXPIRED',
    'SESSION_DELETED',
    'MANUAL_REMINDER',
  ]),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
}).strict();

export type NotificationCreateInput = z.infer<typeof NotificationCreateSchema>;

// ===== RECURRING SLOT SCHEMA =====

export const RecurringSlotSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7, 'Day of week must be 1-7 (ISO: Mon=1, Sun=7)'),
  startHour: z.number().int().min(7).max(22, 'Start hour must be 7-22'),
}).strict();

export type RecurringSlotInput = z.infer<typeof RecurringSlotSchema>;

// ===== TRAINER SCHEMA =====

export const TrainerCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
}).strict();

export type TrainerCreateInput = z.infer<typeof TrainerCreateSchema>;

// ===== QUERY PARAMETER SCHEMAS =====
// Validates and sanitizes GET request query parameters (OWASP input validation)

/** Reusable ISO date string validator (YYYY-MM-DD) */
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

export const DateRangeQuerySchema = z.object({
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
}).strict().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: "startDate must not be after endDate" }
);

export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;

export const AnalyticsQuerySchema = z.object({
  startDate: isoDateString,
  endDate: isoDateString,
}).strict().refine(
  (data) => data.startDate <= data.endDate,
  { message: "startDate must not be after endDate" }
);

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

export const PaymentsQuerySchema = z.object({
  userId: z.string().min(1, 'userId cannot be empty').optional(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
}).strict().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: "startDate must not be after endDate" }
);

export type PaymentsQuery = z.infer<typeof PaymentsQuerySchema>;

export const NotificationsQuerySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;
