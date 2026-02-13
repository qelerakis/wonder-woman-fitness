/**
 * Session Generation Logic
 *
 * Generates weekly sessions from recurring time slots.
 * Sessions are created idempotently — if a session already exists
 * for a given slot+week, it is skipped.
 */

import {
  startOfWeek,
  addDays,
} from 'date-fns';
import { prisma } from './prisma';
import { VOTING_DEADLINE_HOURS_BEFORE } from './constants';
import type { Session, RecurringSlot } from '@/generated/prisma/client';
import type { UserRole } from './constants';

/**
 * Get the Monday of the week for a given date.
 * weekDate is always the Monday (ISO week start).
 *
 * @param date - Any date within the desired week
 * @returns The Monday of that week at midnight UTC
 */
export function getWeekStart(date: Date): Date {
  // date-fns startOfWeek with weekStartsOn: 1 gives Monday
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  // Normalize to midnight UTC
  return new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())
  );
}

/**
 * Calculate the session datetime from weekDate, dayOfWeek, and startHour.
 *
 * @param weekDate - Monday of the week (midnight UTC)
 * @param dayOfWeek - ISO day of week (1=Monday, 7=Sunday)
 * @param startHour - Hour of day (7-22)
 * @returns Date representing the exact session start time
 */
export function getSessionDateTime(
  weekDate: Date,
  dayOfWeek: number,
  startHour: number
): Date {
  // dayOfWeek 1=Monday has offset 0 from weekDate (which is Monday)
  const sessionDate = addDays(weekDate, dayOfWeek - 1);
  // Use explicit UTC construction to avoid local timezone issues
  return new Date(Date.UTC(
    sessionDate.getUTCFullYear(),
    sessionDate.getUTCMonth(),
    sessionDate.getUTCDate(),
    startHour,
    0,
    0,
    0
  ));
}

/**
 * Calculate voting deadline for a session.
 * Deadline is VOTING_DEADLINE_HOURS_BEFORE (24h) before session start.
 *
 * @param sessionDateTime - The session start time
 * @returns The voting deadline datetime
 */
export function calculateVotingDeadline(sessionDateTime: Date): Date {
  // Subtract hours using UTC-safe arithmetic (ms-based)
  return new Date(sessionDateTime.getTime() - VOTING_DEADLINE_HOURS_BEFORE * 60 * 60 * 1000);
}

/**
 * Generate sessions for a given week from all recurring slots.
 *
 * This is idempotent — sessions that already exist (same slot + week)
 * are skipped thanks to the @@unique([recurringSlotId, weekDate]) constraint.
 *
 * @param weekStartDate - Any date within the target week (will be normalized to Monday)
 * @returns Array of created Session records (excludes already-existing ones)
 */
export async function generateSessionsForWeek(
  weekStartDate: Date
): Promise<Session[]> {
  const weekDate = getWeekStart(weekStartDate);

  // Fetch all recurring slots
  const slots = await prisma.recurringSlot.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }],
  });

  const createdSessions: Session[] = [];

  for (const slot of slots) {
    try {
      const sessionDateTime = getSessionDateTime(
        weekDate,
        slot.dayOfWeek,
        slot.startHour
      );
      const votingDeadline = calculateVotingDeadline(sessionDateTime);

      // Use upsert-like pattern: try to create, skip if already exists
      const session = await prisma.session.create({
        data: {
          recurringSlotId: slot.id,
          weekDate,
          votingDeadline,
          votingEnabled: false,
          status: 'SCHEDULED',
        },
      });

      createdSessions.push(session);
    } catch (error) {
      // P2002 = Unique constraint violation (session already exists for this slot+week)
      if (isPrismaUniqueViolation(error)) {
        // Session already exists, skip silently
        continue;
      }
      // Re-throw unexpected errors
      throw error;
    }
  }

  return createdSessions;
}

/**
 * Check if a Prisma error is a unique constraint violation.
 */
function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

/**
 * Fetch sessions for a specific week with all related data.
 *
 * @param weekDate - The Monday of the target week
 * @param userId - Optional user ID for filtering (member sees only their sessions)
 * @param role - User role (affects what data is included)
 * @returns Array of sessions with relations
 */
export async function getSessionsForWeek(
  weekDate: Date,
  userId?: string,
  role?: UserRole
): Promise<SessionWithDetails[]> {
  const normalizedWeekDate = getWeekStart(weekDate);

  const sessions = await prisma.session.findMany({
    where: {
      weekDate: normalizedWeekDate,
      // If member, only show sessions they're assigned to
      ...(role === 'MEMBER' && userId
        ? { members: { some: { userId } } }
        : {}),
      // If trainer, only show sessions they're assigned to
      ...(role === 'TRAINER' && userId
        ? { trainers: { some: { userId } } }
        : {}),
    },
    include: {
      recurringSlot: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
      },
      trainers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      votes: {
        select: {
          id: true,
          userId: true,
          attending: true,
          votedAt: true,
        },
      },
    },
    orderBy: [
      { recurringSlot: { dayOfWeek: 'asc' } },
      { recurringSlot: { startHour: 'asc' } },
    ],
  });

  return sessions as SessionWithDetails[];
}

/**
 * Session with all related data included.
 */
export type SessionWithDetails = Session & {
  recurringSlot: RecurringSlot;
  members: Array<{
    sessionId: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
      status: string;
    };
  }>;
  trainers: Array<{
    sessionId: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  votes: Array<{
    id: string;
    userId: string;
    attending: boolean;
    votedAt: Date;
  }>;
};
