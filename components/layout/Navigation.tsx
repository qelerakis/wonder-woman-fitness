"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
type UserRole = "OWNER" | "TRAINER" | "MEMBER";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavigationProps {
  role: UserRole;
  mobile?: boolean;
  onNavigate?: () => void;
}

// SVG icon components (inline for tree-shaking)
const icons = {
  dashboard: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  ),
  schedule: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  ),
  members: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  ),
  payments: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  ),
  privateSessions: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  ),
  trainers: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  ),
  profile: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
    </svg>
  ),
  notifications: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  ),
};

export function Navigation({
  role,
  mobile = false,
  onNavigate,
}: NavigationProps): React.ReactElement {
  const pathname = usePathname();
  const t = useTranslations("navigation");

  const navLinks: Record<UserRole, NavLink[]> = {
    OWNER: [
      { href: "/dashboard", label: t("dashboard"), icon: icons.dashboard },
      { href: "/owner/schedule", label: t("schedule"), icon: icons.schedule },
      { href: "/members", label: t("members"), icon: icons.members },
      { href: "/payments", label: t("payments"), icon: icons.payments },
      { href: "/private-sessions", label: t("privateSessions"), icon: icons.privateSessions },
      { href: "/trainers", label: t("trainers"), icon: icons.trainers },
      { href: "/owner/notifications", label: t("notifications"), icon: icons.notifications },
    ],
    TRAINER: [
      { href: "/my-schedule", label: t("mySchedule"), icon: icons.schedule },
      { href: "/trainer/payments", label: t("payments"), icon: icons.payments },
      { href: "/trainer/private-sessions", label: t("privateSessions"), icon: icons.privateSessions },
      { href: "/trainer/notifications", label: t("notifications"), icon: icons.notifications },
    ],
    MEMBER: [
      { href: "/member/schedule", label: t("schedule"), icon: icons.schedule },
      { href: "/member/profile", label: t("profile"), icon: icons.profile },
      { href: "/member/notifications", label: t("notifications"), icon: icons.notifications },
    ],
  };

  const links = navLinks[role] || [];

  if (mobile) {
    return (
      <nav className="flex flex-col gap-1 py-2">
        {links.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? "bg-primary-600/20 text-primary-300"
                    : "text-surface-300 hover:bg-surface-800 hover:text-surface-100"
                }
              `}
            >
              {link.icon}
              {link.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="hidden md:flex items-center gap-1">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`
              flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
              transition-colors duration-150
              ${
                isActive
                  ? "bg-primary-600/20 text-primary-300"
                  : "text-surface-400 hover:bg-surface-800 hover:text-surface-100"
              }
            `}
          >
            {link.icon}
            <span className="hidden lg:inline">{link.label}</span>
            <span className="sr-only lg:hidden">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export type { NavigationProps };
