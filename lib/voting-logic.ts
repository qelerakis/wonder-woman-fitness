/**
 * Voting Logic Utilities
 *
 * Handles voting deadline calculations and validation
 */

import { addDays, setHours, setMinutes, setSeconds, setMilliseconds, subHours } from 'date-fns';
import { VOTING_DEADLINE_HOURS_BEFORE } from './constants';
import { Session, RecurringSlot } from '@prisma/client';

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
 * Implementation
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

  // Session time = weekDate + dayOfWeek + startHour
  // dayOfWeek: 1=Monday, 2=Tuesday, ..., 7=Sunday
  const sessionDate = addDays(weekDate, dayOfWeek - 1);
  let sessionTime = setHours(sessionDate, hour);
  sessionTime = setMinutes(sessionTime, 0);
  sessionTime = setSeconds(sessionTime, 0);
  sessionTime = setMilliseconds(sessionTime, 0);

  // Deadline = 24 hours before
  return subHours(sessionTime, VOTING_DEADLINE_HOURS_BEFORE);
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
export function getVoteSummary(votes: Array<{ attending: boolean }>, totalMembers: number) {
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
 * Determine if session has low attendance (1-2 "coming" votes)
 */
export function hasLowAttendance(comingCount: number): boolean {
  return comingCount > 0 && comingCount <= 2;
}
