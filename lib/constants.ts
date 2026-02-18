/**
 * Wonder Woman Fitness - Application Constants
 *
 * All magic numbers and configuration values are defined here.
 * This is the single source of truth for business logic constants.
 */

// ===== CLASS CONFIGURATION =====
export const MAX_CLASS_SIZE = 20;

// ===== PAYMENT CONFIGURATION =====
export const GRACE_PERIOD_DAYS = 10;
export const TRIAL_DAYS = 14;

// Payment reminder days (day of month to send automated reminders)
export const PAYMENT_REMINDER_DAYS = [1, 7, 11] as const;

// ===== VOTING CONFIGURATION =====
export const VOTING_DEADLINE_HOURS_BEFORE = 24;
export const VOTING_URGENCY_HOURS = 6; // Switch to countdown format when deadline is this close

// ===== SCHEDULE CONFIGURATION =====
export const SLOT_START_HOUR = 7;  // 7 AM
export const SLOT_END_HOUR = 22;   // 10 PM (last slot starts at 22:00)

// Days of week (ISO: 1 = Monday, 7 = Sunday — matches Prisma schema)
export const DAYS_OF_WEEK = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
} as const;

export const DAY_NAMES = [
  '', // index 0 unused (ISO starts at 1)
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

// ===== NOTIFICATION CONFIGURATION =====
export const NOTIFICATION_POLL_INTERVAL_MS = 30_000; // 30 seconds

// Trial expiration warning (days before trial ends to notify owner)
export const TRIAL_EXPIRATION_WARNING_DAYS = 2;

// ===== LAYOUT CONFIGURATION =====
export const HEADER_HEIGHT = 64; // pixels (h-16 = 4rem = 64px)
export const PAYMENT_BANNER_HEIGHT = 80; // approximate PaymentBanner height

// ===== FILE UPLOAD CONFIGURATION =====
export const MAX_PHOTO_SIZE_MB = 5;
export const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
export const ALLOWED_PHOTO_FORMATS = ['image/jpeg', 'image/png'] as const;

// Photo dimensions after resize
export const PROFILE_PHOTO_SIZE = 400; // 400x400 square

// ===== TEXT FIELD LIMITS =====
export const MAX_NAME_LENGTH = 100;
export const MAX_PHONE_LENGTH = 20;
export const MAX_DEPART_REASON_LENGTH = 500;
export const MAX_PRIVATE_SESSION_NOTES_LENGTH = 500;
export const MAX_PRIVATE_SESSION_EXERCISE_LENGTH = 1000;
export const MAX_WORKOUT_TITLE_LENGTH = 200;
export const MAX_WORKOUT_DETAILS_LENGTH = 2000;
export const MAX_EMAIL_LENGTH = 254; // RFC 5321
export const MAX_PASSWORD_LENGTH = 128; // bcrypt has 72-byte limit; allow longer input but cap for sanity
export const MAX_PAYMENT_NOTES_LENGTH = 500;
export const MAX_CLIENT_NAME_LENGTH = 100;
export const MAX_NOTIFICATION_TITLE_LENGTH = 200;
export const MAX_NOTIFICATION_BODY_LENGTH = 2000;
export const MAX_RESET_TOKEN_LENGTH = 500;

// ===== PASSWORD CONFIGURATION =====
export const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;
export const TEMP_PASSWORD_LENGTH = 12;

// ===== SESSION GENERATION =====
export const MAX_WEEKS_AHEAD_TO_GENERATE = 4; // Don't auto-generate more than 4 weeks ahead

// ===== PAGINATION =====
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ===== DATE FORMATS =====
export const DATE_FORMAT = 'yyyy-MM-dd';
export const DATETIME_FORMAT = 'yyyy-MM-dd HH:mm';
export const TIME_FORMAT = 'HH:mm';

// ===== CRON JOB SCHEDULES =====
export const CRON_SCHEDULES = {
  PAYMENT_REMINDERS: '0 9 * * *',   // Daily at 9 AM
  TRIAL_EXPIRATION: '0 6 * * *',    // Daily at 6 AM
  VOTING_DEADLINE: '0 0 * * *',      // Daily at midnight
} as const;

// ===== EMAIL CONFIGURATION =====
export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@wonderwomanfitness.mk';

// ===== PAYMENTS FILTER CONFIGURATION =====
export const PAYMENTS_START_YEAR = 2025; // Earliest year shown in payments year dropdown

// ===== ANALYTICS DATE RANGES =====
export const ANALYTICS_DATE_RANGES = {
  THIS_WEEK: 'this_week',
  THIS_MONTH: 'this_month',
  LAST_3_MONTHS: 'last_3_months',
  LAST_6_MONTHS: 'last_6_months',
  THIS_YEAR: 'this_year',
  CUSTOM: 'custom',
} as const;

// ===== USER ROLES =====
export const USER_ROLES = {
  OWNER: 'OWNER',
  TRAINER: 'TRAINER',
  MEMBER: 'MEMBER',
} as const;

// ===== USER STATUSES (as stored in DB) =====
export const USER_STATUSES = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  DEPARTED: 'DEPARTED',
} as const;

// ===== PAYMENT STATUSES (Computed, never stored) =====
export const PAYMENT_STATUSES = {
  PAID: 'PAID',
  GRACE_PERIOD: 'GRACE_PERIOD',
  LOCKED: 'LOCKED',
  OVERRIDE: 'OVERRIDE',
  DEPARTED: 'DEPARTED',
} as const;

// ===== SESSION STATUSES =====
export const SESSION_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  CANCELLED: 'CANCELLED',
} as const;

// ===== NOTIFICATION TYPES =====
export const NOTIFICATION_TYPES = {
  WORKOUT_POSTED: 'WORKOUT_POSTED',
  VOTING_OPENED: 'VOTING_OPENED',
  CLASS_CANCELLED: 'CLASS_CANCELLED',
  MEMBER_MOVED: 'MEMBER_MOVED',
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
  LOCKOUT: 'LOCKOUT',
  MEMBER_DEPARTED: 'MEMBER_DEPARTED',
  REJOIN_REQUEST: 'REJOIN_REQUEST',
  TRIAL_EXPIRING: 'TRIAL_EXPIRING',
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',
  SESSION_DELETED: 'SESSION_DELETED',
  MANUAL_REMINDER: 'MANUAL_REMINDER',
} as const;

// ===== LOW ATTENDANCE THRESHOLD =====
export const LOW_ATTENDANCE_THRESHOLD = 2; // If <= 2 members vote "coming", class is considered low attendance

// ===== TYPE EXPORTS =====
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type UserStatus = typeof USER_STATUSES[keyof typeof USER_STATUSES];
export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];
export type SessionStatus = typeof SESSION_STATUSES[keyof typeof SESSION_STATUSES];
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type AnalyticsDateRange = typeof ANALYTICS_DATE_RANGES[keyof typeof ANALYTICS_DATE_RANGES];
