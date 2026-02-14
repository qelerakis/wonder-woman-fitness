/**
 * Voting Logic Utilities
 *
 * Handles voting deadline calculations, validation, and vote summary.
 * Reuses session datetime calculation from session-generation.ts (single source of truth).
 */

import { LOW_ATTENDANCE_THRESHOLD, MAX_CLASS_SIZE } from './constants';
import { getSessionDateTime, calculateVotingDeadline } from './session-generation';
import type { Session, RecurringSlot } from '@/generated/prisma/client';

/**
 * Calculate voting deadline (24 hours before session time)
 * Overload 1: Accept session and recurring slot objects
 */
export function getVotingDeadline(session: Session, recurringSlot: RecurringSlot): Date;

/**
 * Calculate voting deadline (24 hours before session time)
 * Overload 2: Accept individual parameters
 */
export function getVotingDeadline(weekDate: Date, dayOfWeek: number, startHour: number): Date;

/**
 * Implementation — delegates to session-generation.ts for UTC-safe datetime calculation
 */
export function getVotingDeadline(
  sessionOrWeekDate: Session | Date,
  recurringSlotOrDayOfWeek?: RecurringSlot | number,
  startHour?: number
): Date {
  let weekDate: Date;
  let dayOfWeek: number;
  let hour: number;

  // Check if first argument is a Session object
  if (sessionOrWeekDate && typeof sessionOrWeekDate === 'object' && 'weekDate' in sessionOrWeekDate) {
    weekDate = sessionOrWeekDate.weekDate;
    dayOfWeek = (recurringSlotOrDayOfWeek as RecurringSlot).dayOfWeek;
    hour = (recurringSlotOrDayOfWeek as RecurringSlot).startHour;
  } else {
    // Individual parameters
    weekDate = sessionOrWeekDate as Date;
    dayOfWeek = recurringSlotOrDayOfWeek as number;
    hour = startHour!;
  }

  // Reuse getSessionDateTime for UTC-safe calculation, then subtract 24h
  const sessionTime = getSessionDateTime(weekDate, dayOfWeek, hour);
  return calculateVotingDeadline(sessionTime);
}

/**
 * Check if voting is locked (deadline has passed)
 */
export function isVotingLocked(deadline: Date, now: Date = new Date()): boolean {
  return now >= deadline;
}

/**
 * Calculate time remaining until deadline
 */
export function getTimeUntilDeadline(deadline: Date, now: Date = new Date()): {
  hours: number;
  minutes: number;
  isPast: boolean;
} {
  const diff = deadline.getTime() - now.getTime();

  if (diff < 0) {
    return { hours: 0, minutes: 0, isPast: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes, isPast: false };
}

/**
 * Calculate vote summary from votes array
 */
export function getVoteSummary(votes: Array<{ attending: boolean }>, totalMembers: number): {
  coming: number;
  notComing: number;
  noVote: number;
  total: number;
} {
  const comingCount = votes.filter((v) => v.attending).length;
  const notComingCount = votes.filter((v) => !v.attending).length;
  const noVoteCount = totalMembers - votes.length;

  return {
    coming: comingCount,
    notComing: notComingCount,
    noVote: noVoteCount,
    total: totalMembers,
  };
}

/**
 * Determine if session has low attendance
 * Low = more than 0 but at or below the LOW_ATTENDANCE_THRESHOLD (2)
 */
export function hasLowAttendance(comingCount: number): boolean {
  return comingCount > 0 && comingCount <= LOW_ATTENDANCE_THRESHOLD;
}

/**
 * Check if session is full (coming votes >= MAX_CLASS_SIZE)
 */
export function isSessionFull(comingCount: number): boolean {
  return comingCount >= MAX_CLASS_SIZE;
}
