'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MemberUpdateSchema } from '@/types';

interface ProfileFormProps {
  member: {
    id: string;
    name: string;
    email: string;
    phone: string;
    photo: string | null;
  };
}

export function ProfileForm({ member }: ProfileFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const rawData = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
    };

    const result = MemberUpdateSchema.safeParse(rawData);
    if (!result.success) {
      setError(result.error.issues[0].message);
      setIsSubmitting(false);
      return;
    }

    const data = result.data;

    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Success message */}
      {success && (
        <div role="status" className="p-4 bg-success/20 border border-success/50 rounded-lg text-success text-sm">
          Profile updated successfully!
        </div>
      )}

      {/* Error message */}
      {error && (
        <div role="alert" className="p-4 bg-error/20 border border-error/50 rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-gray-300 mb-2">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={member.name}
          required
          maxLength={100}
          className="w-full px-4 py-2 bg-surface border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-gray-300 mb-2">
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          defaultValue={member.phone}
          required
          maxLength={20}
          className="w-full px-4 py-2 bg-surface border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          defaultValue={member.email}
          disabled
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 mt-1">Contact gym owner to change email</p>
      </div>

      {/* Submit button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
