import Link from "next/link";
import Image from "next/image";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import type { PaymentStatus } from "@/lib/constants";
import { format } from "date-fns";

interface MemberCardData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  status: string;
  joinDate: Date | string;
  trialEndsAt: Date | string | null;
  paymentStatus: PaymentStatus;
}

interface MemberCardProps {
  member: MemberCardData;
  href?: string;
}

export function MemberCard({
  member,
  href,
}: MemberCardProps): React.ReactElement {
  const content = (
    <div className="flex items-center gap-4 rounded-lg border border-surface-700 bg-surface-800 p-4 transition-colors hover:border-primary-600/50 hover:bg-surface-700">
      {/* Avatar */}
      <div className="shrink-0">
        {member.photo ? (
          <Image
            src={member.photo}
            alt={member.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-700 text-lg font-bold text-white">
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-surface-100 truncate">
            {member.name}
          </p>
          <PaymentStatusBadge status={member.paymentStatus} />
        </div>
        <p className="text-xs text-surface-400 truncate">{member.email}</p>
        <p className="mt-0.5 text-xs text-surface-500">
          Joined {format(new Date(member.joinDate), "MMM d, yyyy")}
        </p>
      </div>

      {/* Chevron */}
      {href && (
        <svg className="h-5 w-5 shrink-0 text-surface-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export type { MemberCardProps, MemberCardData };
