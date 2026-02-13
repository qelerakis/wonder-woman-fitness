/**
 * Email Service via Resend
 *
 * Sends transactional emails for notifications.
 * Fire-and-forget pattern — email failures are logged but don't block operations.
 */

import { Resend } from 'resend';
import { EMAIL_FROM } from './constants';
import type { NotificationType } from '@/generated/prisma/client';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not configured. Emails will not be sent.');
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a notification email to a user.
 *
 * @param to - Recipient email address
 * @param type - Notification type (used for template selection)
 * @param title - Email subject line
 * @param body - Email body text
 * @returns true if email was sent successfully, false otherwise
 */
export async function sendNotificationEmail(
  to: string,
  type: NotificationType,
  title: string,
  body: string
): Promise<boolean> {
  try {
    const html = buildEmailHtml(type, title, body);

    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: title,
      html,
    });

    return true;
  } catch (error) {
    console.error(`Failed to send ${type} email to ${to}:`, error);
    return false;
  }
}

/**
 * Build HTML email template based on notification type.
 *
 * Uses a simple branded HTML layout. Each notification type gets
 * an appropriate icon/color accent.
 */
function buildEmailHtml(
  type: NotificationType,
  title: string,
  body: string
): string {
  const accent = getAccentColor(type);
  const icon = getIcon(type);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:${accent};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                ${icon} Wonder Woman Fitness
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:18px;font-weight:600;">
                ${escapeHtml(title)}
              </h2>
              <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6;">
                ${escapeHtml(body)}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #334155;">
              <p style="margin:0;color:#64748b;font-size:12px;">
                This is an automated message from Wonder Woman Fitness.
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Get accent color based on notification type.
 */
function getAccentColor(type: NotificationType): string {
  switch (type) {
    case 'PAYMENT_REMINDER':
    case 'LOCKOUT':
      return '#ef4444'; // red
    case 'TRIAL_EXPIRING':
    case 'TRIAL_EXPIRED':
      return '#f59e0b'; // amber
    case 'CLASS_CANCELLED':
    case 'SESSION_DELETED':
    case 'MEMBER_MOVED':
      return '#f59e0b'; // amber
    case 'WORKOUT_POSTED':
    case 'VOTING_OPENED':
      return '#7c3aed'; // purple (brand)
    case 'MEMBER_DEPARTED':
    case 'REJOIN_REQUEST':
      return '#6366f1'; // indigo
    case 'MANUAL_REMINDER':
    default:
      return '#7c3aed'; // purple (brand)
  }
}

/**
 * Get icon emoji based on notification type.
 */
function getIcon(type: NotificationType): string {
  switch (type) {
    case 'WORKOUT_POSTED':
      return '&#128170;'; // 💪
    case 'VOTING_OPENED':
      return '&#9989;'; // ✅
    case 'CLASS_CANCELLED':
      return '&#10060;'; // ❌
    case 'MEMBER_MOVED':
      return '&#128260;'; // 🔄
    case 'PAYMENT_REMINDER':
      return '&#128176;'; // 💰
    case 'LOCKOUT':
      return '&#128274;'; // 🔒
    case 'MEMBER_DEPARTED':
      return '&#128075;'; // 👋
    case 'REJOIN_REQUEST':
      return '&#128588;'; // 🙌
    case 'TRIAL_EXPIRING':
    case 'TRIAL_EXPIRED':
      return '&#9200;'; // ⏰
    case 'SESSION_DELETED':
      return '&#128465;'; // 🗑️
    case 'MANUAL_REMINDER':
    default:
      return '&#128276;'; // 🔔
  }
}

/**
 * Escape HTML entities to prevent XSS in email content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
