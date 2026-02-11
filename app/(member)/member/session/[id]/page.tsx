/**
 * Member Session Detail Page
 *
 * Shows:
 * - Full workout details
 * - Trainer info
 * - List of group members
 * - Voting buttons (if enabled)
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { SessionDetailClient } from './SessionDetailClient';

export default async function MemberSessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // 1. Verify authentication
  const session = await auth();
  if (!session) redirect('/login');
  if (session.user.role !== 'MEMBER') redirect('/login');

  // 2. Fetch session with details
  const sessionData = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      recurringSlot: true,
      members: {
        include: {
          user: {
            select: { id: true, name: true, photo: true },
          },
        },
      },
      trainers: {
        include: {
          user: {
            select: { id: true, name: true, photo: true },
          },
        },
      },
      votes: {
        where: { userId: session.user.id },
      },
    },
  });

  if (!sessionData) notFound();

  // 3. Check if member is in this session
  const isMember = sessionData.members.some((m) => m.user.id === session.user.id);

  return (
    <SessionDetailClient
      sessionData={sessionData}
      isMember={isMember}
    />
  );
}
