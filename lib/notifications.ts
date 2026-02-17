/**
 * Notification Dispatch System
 *
 * Creates in-app notifications (stored in DB) and sends email notifications
 * via Resend. Email sending is fire-and-forget — failures are logged but
 * don't prevent notification creation.
 */

import { format } from 'date-fns';
import { prisma } from './prisma';
import { sendNotificationEmail } from './email';
import { getSessionDateTime } from './session-generation';
import { DAY_NAMES } from './constants';
import type { NotificationType, Notification } from '@/generated/prisma/client';

/**
 * Parameters for dispatching a notification.
 */
export interface DispatchNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * Dispatch a notification to a user.
 *
 * 1. Creates a Notification record in the database (in-app bell)
 * 2. Looks up the user's email address
 * 3. Sends an email via Resend (fire-and-forget)
 * 4. Updates the notification record with emailSent status
 *
 * @returns The created Notification record
 */
export async function dispatchNotification(
  params: DispatchNotificationParams
): Promise<Notification> {
  const { userId, type, title, body } = params;

  // 1. Create in-app notification and fetch user email in a single query
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      read: false,
      emailSent: false,
    },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  const userEmail = notification.user.email;

  // 2. Send email (fire-and-forget, don't block on failure)
  try {
    const emailSent = await sendNotificationEmail(userEmail, type, title, body);

    // 3. Update notification with email status
    if (emailSent) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true },
      });
    }
  } catch (error) {
    console.error(`Failed to send notification email for ${type}:`, error);
    // Don't rethrow — notification was still created in-app
  }

  // Strip the included user relation before returning
  const { user: _user, ...notificationWithoutUser } = notification;
  return notificationWithoutUser as Notification;
}

/**
 * Dispatch notifications to multiple users.
 * Sends notifications in parallel for efficiency.
 *
 * @returns Array of created Notification records
 */
export async function dispatchNotificationToMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string
): Promise<Notification[]> {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      dispatchNotification({ userId, type, title, body })
    )
  );

  const notifications: Notification[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      notifications.push(result.value);
    } else {
      console.error('Failed to dispatch notification:', result.reason);
    }
  }

  return notifications;
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    return null;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return result.count;
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Build the recipient list for a session cancel/delete notification.
 * If votingEnabled, uses attending voters; otherwise uses assigned members.
 */
export function getSessionNotificationRecipients(
  session: {
    votingEnabled: boolean;
    members: { user: { id: string } }[];
    votes?: { userId: string; attending: boolean }[];
  }
): string[] {
  if (session.votingEnabled && session.votes) {
    return session.votes
      .filter((v) => v.attending)
      .map((v) => v.userId);
  }
  return session.members.map((m) => m.user.id);
}

/**
 * Format the session date for notification messages.
 * Returns e.g. { dayName: "Monday", dateStr: "Mar 9" }
 */
export function formatSessionForNotification(
  weekDate: Date,
  dayOfWeek: number,
  startHour: number
): { dayName: string; dateStr: string } {
  const dayName = DAY_NAMES[dayOfWeek] || 'Unknown';
  const sessionDate = getSessionDateTime(weekDate, dayOfWeek, startHour);
  const dateStr = format(sessionDate, 'MMM d');
  return { dayName, dateStr };
}
