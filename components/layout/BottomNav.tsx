"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type UserRole = "OWNER" | "TRAINER" | "MEMBER";

interface BottomNavProps {
  role: UserRole;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const MEMBER_ITEMS: NavItem[] = [
  {
    href: "/member/schedule",
    label: "Schedule",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/member/notifications",
    label: "Notifications",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    href: "/member/profile",
    label: "Profile",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

const TRAINER_ITEMS: NavItem[] = [
  {
    href: "/trainer/schedule",
    label: "Schedule",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/trainer/payments",
    label: "Payments",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path
          fillRule="evenodd"
          d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/trainer/notifications",
    label: "Notifications",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
];

export function BottomNav({ role }: BottomNavProps): React.ReactElement | null {
  const pathname = usePathname();

  if (role === "OWNER") return null;

  const items = role === "MEMBER" ? MEMBER_ITEMS : TRAINER_ITEMS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-700 bg-surface-900/95 backdrop-blur-sm md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 text-xs transition-colors ${
                isActive
                  ? "text-primary-400"
                  : "text-surface-400 hover:text-surface-200"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export type { BottomNavProps };
