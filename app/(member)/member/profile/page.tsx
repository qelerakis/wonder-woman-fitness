/**
 * Member Profile Page
 *
 * Edit own profile (name, phone, photo)
 * Cannot edit email or monthlyRate (owner only)
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProfileForm } from '@/components/profile/ProfileForm';

export default async function MemberProfilePage() {
  // 1. Verify authentication and role
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'MEMBER') {
    redirect('/login');
  }

  // 2. Fetch member data
  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      status: true,
    },
  });

  if (!member) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-100">My Profile</h1>
          <p className="text-gray-400 mt-1">Update your personal information</p>
        </div>

        {/* Profile form */}
        <div className="bg-surface/50 rounded-lg p-6 border border-gray-800">
          {/* Photo upload section */}
          <div className="mb-6 pb-6 border-b border-gray-700">
            <label className="block text-sm font-semibold text-gray-300 mb-3">Profile Photo</label>
            <div className="flex items-center gap-4">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-2xl">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                <p className="text-xs text-gray-500 mt-2">JPEG, PNG, or WebP. Max 5 MB.</p>
              </div>
            </div>
          </div>

          <ProfileForm member={member} />

          {/* Departure section */}
          <div className="mt-8 pt-8 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Stop Training</h3>
            <p className="text-sm text-gray-400 mb-4">
              If you are no longer training, you can mark your account as inactive.
            </p>
            <button
              type="button"
              className="px-4 py-2 bg-error/20 text-error border border-error/50 rounded-lg hover:bg-error/30 transition-colors text-sm font-medium"
            >
              Stop Training
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
