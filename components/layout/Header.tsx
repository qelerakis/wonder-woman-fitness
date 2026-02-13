"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Navigation } from "./Navigation";

type UserRole = "OWNER" | "TRAINER" | "MEMBER";

interface HeaderProps {
  userName: string;
  userRole: UserRole;
  notificationCount?: number;
}

export function Header({
  userName,
  userRole,
  notificationCount = 0,
}: HeaderProps): React.ReactElement {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const roleLabel =
    userRole === "OWNER"
      ? "Owner"
      : userRole === "TRAINER"
        ? "Trainer"
        : "Member";

  // Close user dropdown on Escape key
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setUserMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (userMenuOpen) {
      document.addEventListener("keydown", handleEscapeKey);
    }
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [userMenuOpen, handleEscapeKey]);

  return (
    <header className="sticky top-0 z-40 border-b border-surface-700 bg-surface-900/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href={userRole === "OWNER" ? "/dashboard" : userRole === "TRAINER" ? "/my-schedule" : "/member/schedule"}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-sm font-bold text-white">WW</span>
            </div>
            <span className="hidden sm:block text-lg font-bold text-surface-100">
              Wonder Woman
            </span>
          </Link>

          {/* Desktop Navigation */}
          <Navigation role={userRole} />

          {/* Right side: notification bell + user menu */}
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <Link
              href={userRole === "OWNER" ? "/owner/notifications" : userRole === "TRAINER" ? "/trainer/notifications" : "/member/notifications"}
              className="relative rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition-colors"
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ""}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1 text-xs font-bold text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>

            {/* User Menu (Desktop) */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-surface-100 transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden lg:block max-w-[120px] truncate">
                  {userName}
                </span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl">
                    <div className="border-b border-surface-700 px-4 py-2.5">
                      <p className="text-sm font-medium text-surface-100 truncate">
                        {userName}
                      </p>
                      <p className="text-xs text-surface-400">{roleLabel}</p>
                    </div>
                    {userRole !== "OWNER" && (
                      <Link
                        href="/member/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                        </svg>
                        Profile
                      </Link>
                    )}
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-error-400 hover:bg-surface-700 hover:text-error-300"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-100 md:hidden transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-surface-700 md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-2">
            <Navigation
              role={userRole}
              mobile
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <div className="border-t border-surface-700 mt-2 pt-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-100">{userName}</p>
                  <p className="text-xs text-surface-400">{roleLabel}</p>
                </div>
              </div>
              {userRole !== "OWNER" && (
                <Link
                  href="/member/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-surface-300 hover:bg-surface-800"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                  Profile
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-error-400 hover:bg-surface-800"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export type { HeaderProps };
