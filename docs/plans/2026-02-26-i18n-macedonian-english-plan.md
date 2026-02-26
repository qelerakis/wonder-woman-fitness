# i18n Macedonian/English Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Macedonian (default) and English language support with a cookie-based toggle in the Header.

**Architecture:** `next-intl` library with cookie-based locale detection (no URL prefix changes). Server Components use `getTranslations()`, Client Components use `useTranslations()`. A `NextIntlClientProvider` in the root layout passes messages to all client components.

**Tech Stack:** next-intl, date-fns locales (mk, enUS), Next.js 15 App Router, Vitest

---

## Task 1: Install next-intl

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install next-intl`

**Step 2: Verify installation**

Run: `npm ls next-intl`
Expected: `next-intl@3.x.x` (or latest compatible)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install next-intl for i18n support"
```

---

## Task 2: Create i18n request config

**Files:**
- Create: `i18n/request.ts`

**Step 1: Create the i18n request config**

```typescript
// i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["mk", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "mk";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    cookieLocale && locales.includes(cookieLocale as Locale)
      ? cookieLocale
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**Step 2: Commit**

```bash
git add i18n/request.ts
git commit -m "feat: add next-intl request config with cookie-based locale"
```

---

## Task 3: Update next.config.ts

**Files:**
- Modify: `next.config.ts`

**Step 1: Add next-intl plugin**

Change the file to:

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  // ... (keep ALL existing security headers exactly as-is)
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "bcrypt"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
```

Key changes:
- Add `import createNextIntlPlugin from "next-intl/plugin"` at top
- Add `const withNextIntl = createNextIntlPlugin("./i18n/request.ts")`
- Change `export default nextConfig` to `export default withNextIntl(nextConfig)`
- Keep ALL security headers exactly as they are

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: integrate next-intl plugin into Next.js config"
```

---

## Task 4: Create English translation file

**Files:**
- Create: `messages/en.json`

**Step 1: Create the complete English translation file**

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "close": "Close",
    "confirm": "Confirm",
    "loading": "Loading...",
    "back": "Back",
    "clear": "Clear",
    "add": "Add",
    "remove": "Remove",
    "search": "Search",
    "actions": "Actions",
    "yes": "Yes",
    "no": "No",
    "or": "or",
    "all": "All",
    "none": "None",
    "submit": "Submit",
    "networkError": "Network error",
    "unexpectedError": "An unexpected error occurred",
    "requestTimeout": "Request timed out. Please try again.",
    "noResults": "No results found"
  },
  "brand": {
    "name": "Wonder Woman Fitness",
    "short": "Wonder Woman",
    "tagline": "Studio Management Platform",
    "logo": "WW"
  },
  "language": {
    "toggle": "Language",
    "mk": "MK",
    "en": "EN"
  },
  "auth": {
    "signIn": "Sign In",
    "signingIn": "Signing in...",
    "signOut": "Sign out",
    "email": "Email",
    "emailPlaceholder": "you@example.com",
    "password": "Password",
    "passwordPlaceholder": "Enter your password",
    "invalidCredentials": "Invalid email or password",
    "noAccount": "Don't have an account?",
    "register": "Register",
    "forgotPassword": "Forgot your password?",
    "recentlyRegistered": "Recently registered?",
    "resendVerification": "Resend verification email",
    "createAccount": "Create Account",
    "creatingAccount": "Creating account...",
    "fullName": "Full Name",
    "fullNamePlaceholder": "Your full name",
    "phone": "Phone",
    "phonePlaceholder": "+389 70 123 456",
    "confirmPassword": "Confirm Password",
    "confirmPasswordPlaceholder": "Confirm your password",
    "alreadyHaveAccount": "Already have an account?",
    "registrationFailed": "Registration failed",
    "checkEmail": "Check Your Email",
    "checkEmailSent": "We sent a verification link to",
    "checkEmailYourEmail": "your email",
    "checkEmailClickLink": "Click the link to activate your account.",
    "checkEmailWait": "Please wait before resending.",
    "checkEmailResendFailed": "Failed to resend. Please try again.",
    "checkEmailResent": "Verification email resent!",
    "checkEmailSending": "Sending...",
    "checkEmailResendIn": "Resend in {cooldown}s",
    "checkEmailResendButton": "Resend Verification Email",
    "checkEmailWrongEmail": "Wrong email?",
    "checkEmailRegisterAgain": "Register again",
    "verifyInvalidLink": "Invalid Link",
    "verifyNoToken": "No verification token provided.",
    "verifyBackToRegister": "Back to Register",
    "verifyFailed": "Verification Failed",
    "verifyRegisterAgain": "Register Again",
    "verifySuccess": "Email Verified!",
    "verifySuccessMessage": "Your account has been created successfully. You can now sign in.",
    "resetPassword": "Reset Password",
    "resetPasswordMessage": "To reset your password, please contact the gym owner directly.",
    "backToLogin": "Back to Login"
  },
  "validation": {
    "required": "This field is required",
    "nameMinLength": "Name must be at least 2 characters",
    "invalidEmail": "Please enter a valid email",
    "invalidEmailFormat": "Invalid email format",
    "passwordMinLength": "Password must be at least 8 characters",
    "passwordRequirements": "8+ characters, 1 number, 1 special",
    "passwordComplexity": "Password must contain at least one number and one special character",
    "passwordsDoNotMatch": "Passwords do not match",
    "nameRequired": "Name is required",
    "emailRequired": "Email is required",
    "currentPasswordRequired": "Current password required",
    "newPasswordRequired": "New password required",
    "positiveAmount": "Amount must be a positive number",
    "periodStartRequired": "Period start is required",
    "periodEndAfterStart": "Period end must be after start"
  },
  "roles": {
    "owner": "Owner",
    "trainer": "Trainer",
    "member": "Member"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "schedule": "Schedule",
    "members": "Members",
    "payments": "Payments",
    "privateSessions": "Private Sessions",
    "trainers": "Trainers",
    "notifications": "Notifications",
    "mySchedule": "My Schedule",
    "profile": "Profile",
    "toggleMenu": "Toggle menu"
  },
  "schedule": {
    "title": "Schedule",
    "subtitle": "Manage weekly class schedule",
    "memberTitle": "My Schedule",
    "memberSubtitle": "View your upcoming classes and vote on attendance",
    "trainerTitle": "My Schedule",
    "trainerSubtitle": "Sessions you are assigned to train",
    "generateWeek": "Generate Week",
    "addSession": "Add Session",
    "sessions": "sessions",
    "cancelled": "Cancelled",
    "cancelledCount": "cancelled",
    "recurringSlots": "recurring slots",
    "loadingSessions": "Loading sessions...",
    "failedToLoad": "Failed to load sessions",
    "sessionsGenerated": "Sessions generated",
    "sessionsGeneratedMessage": "Weekly sessions have been created from recurring slots.",
    "failedToGenerate": "Failed to generate sessions",
    "prev": "Prev",
    "next": "Next",
    "coming": "coming",
    "membersCount": "members",
    "going": "Going",
    "notGoing": "Not going",
    "byDeadline": "by {deadline}",
    "full": "Full",
    "fullMessage": "This session is full — voting is closed.",
    "voting": "Voting",
    "votingOpen": "Voting Open",
    "votingClosed": "Voting Closed",
    "votingClosesIn": "Closes in {hours}h {minutes}m",
    "votingClosesAt": "Closes {deadline}",
    "votingDisabled": "Voting disabled",
    "votingEnabled": "Voting enabled",
    "failedToUpdateVoting": "Failed to update voting",
    "yourAttendance": "Your Attendance",
    "willYouAttend": "Will you attend this session?",
    "imComing": "I'm coming",
    "imNotComing": "I'm not coming",
    "youreComingBanner": "You're marked as coming!",
    "youreNotComingBanner": "You're marked as not coming",
    "failedToVote": "Failed to vote",
    "voteByDeadline": "Vote by {deadline}",
    "votingHasClosed": "Voting has closed",
    "failedToSubmitVote": "Failed to submit your vote. Please try again.",
    "assignedMembers": "Assigned Members"
  },
  "createSession": {
    "oneOff": "One-off",
    "recurring": "Recurring",
    "oneOffCreated": "One-off session created",
    "timeConflict": "Time conflict",
    "timeConflictMessage": "A session already exists at this day and time.",
    "failedToCreate": "Failed to create session",
    "slotAlreadyExists": "Slot already exists",
    "slotAlreadyExistsMessage": "A recurring slot already exists at this day and time.",
    "failedToCreateSlot": "Failed to create recurring slot",
    "slotAndSessionCreated": "Recurring slot & session created",
    "slotCreatedMessage": "New {day} {time} slot created.",
    "slotCreatedSessionFailed": "Slot created but session failed",
    "slotCreatedSessionFailedMessage": "The recurring slot was created. Try generating the week to create the session."
  },
  "deleteSlot": {
    "title": "Delete Recurring Slot",
    "description": "Permanently remove the {day} {time} recurring slot.",
    "whatShouldHappen": "What should happen?",
    "stopFutureOnly": "Stop future generation only",
    "stopFutureDescription": "The slot template will be removed. Already scheduled sessions stay on the calendar.",
    "deleteSlotAndSessions": "Delete slot and all upcoming sessions",
    "deleteSlotAndSessionsDescription": "Removes the template and all sessions from this week onward. Past sessions are kept for records. Members will be notified."
  },
  "attendance": {
    "title": "Attendance",
    "presentCount": "{presentCount} / {totalCount} present",
    "noPeopleAvailable": "No people available.",
    "failedToUpdate": "Failed to update attendance",
    "failedToAddMember": "Failed to add member to session",
    "failedToMark": "Failed to mark attendance",
    "memberAddedAndPresent": "{name} added and marked present",
    "failedToAdd": "Failed to add member"
  },
  "workout": {
    "title": "Workout",
    "noWorkout": "No workout posted yet",
    "saved": "Workout saved",
    "updated": "Workout updated",
    "failedToSave": "Failed to save workout"
  },
  "sessionDetail": {
    "sessionCancelled": "Session cancelled",
    "failedToCancel": "Failed to cancel session",
    "sessionDeleted": "Session deleted",
    "failedToDelete": "Failed to delete session",
    "slotDeleted": "Recurring slot deleted",
    "trainerRemoved": "Trainer removed",
    "trainerAssigned": "Trainer assigned",
    "failedToUpdateTrainer": "Failed to update",
    "memberRemoved": "Member removed",
    "memberAssigned": "Member assigned",
    "failedToAssignMember": "Failed to assign member"
  },
  "assignment": {
    "assigned": "Assigned",
    "add": "Add",
    "noPeopleAvailable": "No people available."
  },
  "payments": {
    "title": "Payments",
    "subtitle": "Track and record member payments",
    "recordPayment": "Record Payment",
    "editPayment": "Edit Payment",
    "updatePayment": "Update Payment",
    "deletePayment": "Delete Payment",
    "filterByMonth": "Filter by month",
    "filterByYear": "Filter by year",
    "searchByName": "Search by name...",
    "searchAriaLabel": "Search payments by member name",
    "thisMonth": "This Month",
    "allTime": "All Time",
    "paidMembers": "Paid Members",
    "unpaid": "Unpaid",
    "unpaidMembers": "Unpaid Members",
    "unpaidMembersSubtitle": "Members with outstanding payments",
    "paymentHistory": "Payment History",
    "paymentsCount": "{count} payments",
    "paymentsInPeriod": "in {filterLabel}",
    "noPayments": "No payments recorded yet",
    "member": "Member",
    "amount": "Amount",
    "amountMKD": "Amount (MKD)",
    "amountPlaceholder": "e.g., 1500",
    "period": "Period",
    "paid": "Paid",
    "paidAt": "Paid At",
    "periodStart": "Period Start",
    "periodEnd": "Period End",
    "notes": "Notes (optional)",
    "notesPlaceholder": "Any additional notes...",
    "recordedBy": "Recorded By",
    "selectMember": "Select a member...",
    "editPaymentFor": "Edit payment for {memberName}",
    "deletePaymentFor": "Delete payment for {memberName}",
    "deleteConfirmation": "Are you sure you want to delete this payment of {amount} for {memberName}? This action cannot be undone.",
    "failedToRecord": "Failed to record payment. Please try again.",
    "failedToUpdate": "Failed to update payment",
    "failedToDelete": "Failed to delete payment"
  },
  "paymentStatus": {
    "paid": "Paid",
    "gracePeriod": "Grace Period",
    "locked": "Locked",
    "override": "Override",
    "departed": "Departed"
  },
  "paymentBanner": {
    "paymentDue": "Payment due.",
    "daysRemaining": "You have {count, plural, one {# day} other {# days}} remaining before your account is locked. Please pay your trainer or the gym owner.",
    "lockedTomorrow": "Your account will be locked tomorrow. Please pay your trainer or the gym owner.",
    "accountLocked": "Account locked.",
    "lockedMessage": "Your access is restricted until payment is received. Please contact the gym owner."
  },
  "lockout": {
    "title": "Account Locked",
    "message": "Hi {memberName}, your account has been locked due to an overdue payment. Your schedule access and class attendance have been temporarily restricted.",
    "toRestore": "To restore your access:",
    "step1": "1. Make your monthly payment to the gym owner in person (cash only)",
    "step2": "2. The owner will record your payment in the system",
    "step3": "3. Your access will be restored automatically",
    "contactOwner": "Questions? Contact {ownerEmail}",
    "logOut": "Log Out"
  },
  "dashboard": {
    "title": "Dashboard",
    "overview": "overview",
    "activeMembers": "Active Members",
    "revenue": "Revenue",
    "outstanding": "Outstanding",
    "trials": "Trials",
    "onTrial": "on trial",
    "allMembersCurrent": "All members current",
    "noActiveTrials": "No active trials",
    "graceAndLocked": "grace, locked",
    "attendanceTracking": "Attendance Tracking",
    "quickActions": "Quick Actions",
    "manageSchedule": "Manage Schedule",
    "recordPayment": "Record Payment",
    "privateSessionsLink": "Private Sessions",
    "manageTrainers": "Manage Trainers"
  },
  "notifications": {
    "title": "Notifications",
    "markAllRead": "Mark all as read",
    "noNotifications": "No notifications",
    "send": "Send Notification",
    "sendTitle": "Send Notification",
    "audience": "Audience",
    "allActiveMembers": "All active members",
    "trialMembersOnly": "Trial members only",
    "membersFromSlot": "Members from a session slot",
    "membersByPaymentStatus": "Members by payment status",
    "selectSpecific": "Select specific members",
    "sessionSlot": "Session Slot",
    "searchMembers": "Search members...",
    "sentToCount": "Notification sent to {count} member(s)",
    "failedToSend": "Failed to send notification",
    "notificationTitle": "Title",
    "notificationBody": "Body"
  },
  "members": {
    "title": "Members",
    "count": "{count} member(s)",
    "addMember": "Add Member",
    "noMembers": "No members yet",
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "status": "Status",
    "joined": "Joined",
    "active": "Active",
    "trial": "Trial",
    "departed": "Departed"
  },
  "trainers": {
    "title": "Trainers",
    "count": "{count} trainer(s)",
    "addTrainer": "Add Trainer",
    "noTrainers": "No trainers yet",
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "phoneOptional": "Phone (optional)",
    "phonePlaceholder": "+389...",
    "status": "Status",
    "added": "Added",
    "fullName": "Full Name",
    "fullNamePlaceholder": "Trainer's full name",
    "emailPlaceholder": "trainer@example.com",
    "tempPasswordNote": "The trainer will receive an email with a temporary password to set up their account.",
    "trainerCreated": "Trainer created",
    "trainerCreatedMessage": "A temporary password has been sent to their email.",
    "failedToCreate": "Failed to create trainer"
  },
  "privateSessions": {
    "title": "Private Sessions",
    "previousMonth": "Previous month",
    "nextMonth": "Next month",
    "allSessions": "All sessions",
    "monthly": "Monthly",
    "newSession": "New Session",
    "thisMonth": "This Month",
    "allTime": "All Time",
    "totalSessions": "Total Sessions",
    "unpaid": "Unpaid",
    "sessionsLabel": "Sessions",
    "sessionsCount": "{count} sessions",
    "noSessions": "No private sessions recorded yet",
    "client": "Client",
    "trainer": "Trainer",
    "date": "Date",
    "amount": "Amount",
    "details": "Details",
    "status": "Status",
    "paid": "Paid",
    "newTitle": "New Private Session",
    "clientName": "Client Name",
    "clientNamePlaceholder": "Client's full name",
    "scheduledAt": "Scheduled At",
    "amountMKD": "Amount (MKD)",
    "amountPlaceholder": "e.g., 500",
    "trainerSelect": "Trainer",
    "alreadyPaid": "Already paid",
    "exerciseDetails": "Exercise Details (optional)",
    "exerciseDetailsPlaceholder": "Describe the exercises planned...",
    "notes": "Notes (optional)",
    "notesPlaceholder": "Any additional notes...",
    "createSession": "Create Session"
  },
  "profile": {
    "title": "My Profile",
    "profileInformation": "Profile Information",
    "profileUpdated": "Profile updated",
    "failedToUpdate": "Failed to update",
    "passwordChanged": "Password changed",
    "changePassword": "Change Password",
    "currentPassword": "Current Password",
    "newPassword": "New Password",
    "confirmNewPassword": "Confirm New Password"
  },
  "departed": {
    "greeting": "We miss you, {userName}!",
    "message": "Your account is currently deactivated. Your training history and records are safely preserved.",
    "rejoinPrompt": "Ready to get back to training? Send a rejoin request and the gym owner will reactivate your account.",
    "rejoinSent": "Your rejoin request has been sent! The owner will review it and get back to you.",
    "rejoinButton": "Request to Rejoin",
    "rejoinToastTitle": "Rejoin request sent",
    "rejoinToastMessage": "The owner has been notified of your request.",
    "failedToSend": "Failed to send request"
  },
  "stopTraining": {
    "title": "Stop Training",
    "greeting": "We're sad to see you go, {userName}",
    "areYouSure": "Are you sure?",
    "deactivateWarning": "This will deactivate your account and remove you from all future sessions.",
    "whatHappens": "What happens when you leave:",
    "consequence1": "You will be removed from all upcoming class sessions",
    "consequence2": "You will lose access to the schedule and voting",
    "consequence3": "Your payment and attendance history will be preserved",
    "consequence4": "You can request to rejoin at any time",
    "reasonLabel": "Reason for leaving (optional)",
    "reasonPlaceholder": "Help us improve — why are you leaving?",
    "reasonCharCount": "{count}/{max} characters",
    "confirmCheckbox": "I understand this will deactivate my account",
    "stopButton": "Stop Training",
    "accountDeactivated": "Your account has been deactivated",
    "failedToProcess": "Failed to process request"
  },
  "dateRange": {
    "thisWeek": "This Week",
    "thisMonth": "This Month",
    "last3Months": "Last 3 Months",
    "last6Months": "Last 6 Months",
    "thisYear": "This Year",
    "custom": "Custom"
  }
}
```

**Step 2: Commit**

```bash
git add messages/en.json
git commit -m "feat: add English translation file with all UI strings"
```

---

## Task 5: Create Macedonian translation file

**Files:**
- Create: `messages/mk.json`

**Step 1: Create the complete Macedonian translation file**

```json
{
  "common": {
    "save": "Зачувај",
    "cancel": "Откажи",
    "delete": "Избриши",
    "edit": "Измени",
    "close": "Затвори",
    "confirm": "Потврди",
    "loading": "Вчитување...",
    "back": "Назад",
    "clear": "Исчисти",
    "add": "Додај",
    "remove": "Отстрани",
    "search": "Пребарај",
    "actions": "Акции",
    "yes": "Да",
    "no": "Не",
    "or": "или",
    "all": "Сите",
    "none": "Ништо",
    "submit": "Испрати",
    "networkError": "Грешка во мрежата",
    "unexpectedError": "Настана неочекувана грешка",
    "requestTimeout": "Барањето истече. Обидете се повторно.",
    "noResults": "Нема резултати"
  },
  "brand": {
    "name": "Wonder Woman Fitness",
    "short": "Wonder Woman",
    "tagline": "Платформа за управување со студио",
    "logo": "WW"
  },
  "language": {
    "toggle": "Јазик",
    "mk": "МК",
    "en": "EN"
  },
  "auth": {
    "signIn": "Најави се",
    "signingIn": "Најавување...",
    "signOut": "Одјави се",
    "email": "Е-пошта",
    "emailPlaceholder": "you@example.com",
    "password": "Лозинка",
    "passwordPlaceholder": "Внесете ја вашата лозинка",
    "invalidCredentials": "Невалидна е-пошта или лозинка",
    "noAccount": "Немате сметка?",
    "register": "Регистрирај се",
    "forgotPassword": "Ја заборавивте лозинката?",
    "recentlyRegistered": "Неодамна се регистриравте?",
    "resendVerification": "Испрати го повторно мејлот за верификација",
    "createAccount": "Креирај сметка",
    "creatingAccount": "Креирање сметка...",
    "fullName": "Целосно име",
    "fullNamePlaceholder": "Вашето целосно име",
    "phone": "Телефон",
    "phonePlaceholder": "+389 70 123 456",
    "confirmPassword": "Потврди лозинка",
    "confirmPasswordPlaceholder": "Потврдете ја вашата лозинка",
    "alreadyHaveAccount": "Веќе имате сметка?",
    "registrationFailed": "Регистрацијата не успеа",
    "checkEmail": "Проверете ја е-поштата",
    "checkEmailSent": "Испративме линк за верификација на",
    "checkEmailYourEmail": "вашата е-пошта",
    "checkEmailClickLink": "Кликнете на линкот за да ја активирате сметката.",
    "checkEmailWait": "Почекајте пред повторно испраќање.",
    "checkEmailResendFailed": "Неуспешно повторно испраќање. Обидете се повторно.",
    "checkEmailResent": "Мејлот за верификација е повторно испратен!",
    "checkEmailSending": "Испраќање...",
    "checkEmailResendIn": "Испрати повторно за {cooldown}с",
    "checkEmailResendButton": "Испрати го повторно мејлот за верификација",
    "checkEmailWrongEmail": "Погрешна е-пошта?",
    "checkEmailRegisterAgain": "Регистрирај се повторно",
    "verifyInvalidLink": "Невалиден линк",
    "verifyNoToken": "Не е обезбеден токен за верификација.",
    "verifyBackToRegister": "Назад кон регистрација",
    "verifyFailed": "Верификацијата не успеа",
    "verifyRegisterAgain": "Регистрирај се повторно",
    "verifySuccess": "Е-поштата е верифицирана!",
    "verifySuccessMessage": "Вашата сметка е успешно креирана. Сега можете да се најавите.",
    "resetPassword": "Ресетирај лозинка",
    "resetPasswordMessage": "За ресетирање на лозинката, контактирајте го сопственикот на теретаната директно.",
    "backToLogin": "Назад кон најава"
  },
  "validation": {
    "required": "Ова поле е задолжително",
    "nameMinLength": "Името мора да има најмалку 2 карактери",
    "invalidEmail": "Внесете валидна е-пошта",
    "invalidEmailFormat": "Невалиден формат на е-пошта",
    "passwordMinLength": "Лозинката мора да има најмалку 8 карактери",
    "passwordRequirements": "8+ карактери, 1 број, 1 специјален",
    "passwordComplexity": "Лозинката мора да содржи најмалку еден број и еден специјален карактер",
    "passwordsDoNotMatch": "Лозинките не се совпаѓаат",
    "nameRequired": "Името е задолжително",
    "emailRequired": "Е-поштата е задолжителна",
    "currentPasswordRequired": "Потребна е тековната лозинка",
    "newPasswordRequired": "Потребна е новата лозинка",
    "positiveAmount": "Износот мора да биде позитивен број",
    "periodStartRequired": "Почетокот на периодот е задолжителен",
    "periodEndAfterStart": "Крајот на периодот мора да биде по почетокот"
  },
  "roles": {
    "owner": "Сопственик",
    "trainer": "Тренер",
    "member": "Член"
  },
  "navigation": {
    "dashboard": "Контролна табла",
    "schedule": "Распоред",
    "members": "Членови",
    "payments": "Плаќања",
    "privateSessions": "Приватни сесии",
    "trainers": "Тренери",
    "notifications": "Известувања",
    "mySchedule": "Мој распоред",
    "profile": "Профил",
    "toggleMenu": "Мени"
  },
  "schedule": {
    "title": "Распоред",
    "subtitle": "Управувајте со неделниот распоред на часови",
    "memberTitle": "Мој распоред",
    "memberSubtitle": "Прегледајте ги претстојните часови и гласајте за присуство",
    "trainerTitle": "Мој распоред",
    "trainerSubtitle": "Сесии на кои сте доделени да тренирате",
    "generateWeek": "Генерирај недела",
    "addSession": "Додај сесија",
    "sessions": "сесии",
    "cancelled": "Откажана",
    "cancelledCount": "откажани",
    "recurringSlots": "редовни термини",
    "loadingSessions": "Вчитување сесии...",
    "failedToLoad": "Неуспешно вчитување на сесии",
    "sessionsGenerated": "Сесиите се генерирани",
    "sessionsGeneratedMessage": "Неделните сесии се креирани од редовните термини.",
    "failedToGenerate": "Неуспешно генерирање на сесии",
    "prev": "Прет",
    "next": "След",
    "coming": "доаѓаат",
    "membersCount": "членови",
    "going": "Доаѓам",
    "notGoing": "Не доаѓам",
    "byDeadline": "до {deadline}",
    "full": "Полна",
    "fullMessage": "Оваа сесија е полна — гласањето е затворено.",
    "voting": "Гласање",
    "votingOpen": "Гласањето е отворено",
    "votingClosed": "Гласањето е затворено",
    "votingClosesIn": "Се затвора за {hours}ч {minutes}м",
    "votingClosesAt": "Се затвора {deadline}",
    "votingDisabled": "Гласањето е оневозможено",
    "votingEnabled": "Гласањето е овозможено",
    "failedToUpdateVoting": "Неуспешно ажурирање на гласањето",
    "yourAttendance": "Вашето присуство",
    "willYouAttend": "Дали ќе присуствувате на оваа сесија?",
    "imComing": "Доаѓам",
    "imNotComing": "Не доаѓам",
    "youreComingBanner": "Означени сте дека доаѓате!",
    "youreNotComingBanner": "Означени сте дека не доаѓате",
    "failedToVote": "Неуспешно гласање",
    "voteByDeadline": "Гласајте до {deadline}",
    "votingHasClosed": "Гласањето е затворено",
    "failedToSubmitVote": "Неуспешно поднесување на гласот. Обидете се повторно.",
    "assignedMembers": "Доделени членови"
  },
  "createSession": {
    "oneOff": "Еднократна",
    "recurring": "Редовна",
    "oneOffCreated": "Еднократна сесија е креирана",
    "timeConflict": "Конфликт на термин",
    "timeConflictMessage": "Веќе постои сесија во овој ден и час.",
    "failedToCreate": "Неуспешно креирање на сесија",
    "slotAlreadyExists": "Терминот веќе постои",
    "slotAlreadyExistsMessage": "Веќе постои редовен термин во овој ден и час.",
    "failedToCreateSlot": "Неуспешно креирање на редовен термин",
    "slotAndSessionCreated": "Редовен термин и сесија се креирани",
    "slotCreatedMessage": "Нов {day} {time} термин е креиран.",
    "slotCreatedSessionFailed": "Терминот е креиран, но сесијата не успеа",
    "slotCreatedSessionFailedMessage": "Редовниот термин е креиран. Генерирајте ја неделата за да ја креирате сесијата."
  },
  "deleteSlot": {
    "title": "Избриши редовен термин",
    "description": "Трајно отстранете го {day} {time} редовниот термин.",
    "whatShouldHappen": "Што да се случи?",
    "stopFutureOnly": "Запри само идно генерирање",
    "stopFutureDescription": "Шаблонот за терминот ќе биде отстранет. Веќе закажаните сесии остануваат во календарот.",
    "deleteSlotAndSessions": "Избриши го терминот и сите претстојни сесии",
    "deleteSlotAndSessionsDescription": "Го отстранува шаблонот и сите сесии од оваа недела натаму. Минатите сесии се зачувани. Членовите ќе бидат известени."
  },
  "attendance": {
    "title": "Присуство",
    "presentCount": "{presentCount} / {totalCount} присутни",
    "noPeopleAvailable": "Нема достапни лица.",
    "failedToUpdate": "Неуспешно ажурирање на присуството",
    "failedToAddMember": "Неуспешно додавање на член во сесијата",
    "failedToMark": "Неуспешно означување на присуство",
    "memberAddedAndPresent": "{name} е додаден/а и означен/а како присутен/на",
    "failedToAdd": "Неуспешно додавање на член"
  },
  "workout": {
    "title": "Тренинг",
    "noWorkout": "Сè уште нема објавен тренинг",
    "saved": "Тренингот е зачуван",
    "updated": "Тренингот е ажуриран",
    "failedToSave": "Неуспешно зачувување на тренингот"
  },
  "sessionDetail": {
    "sessionCancelled": "Сесијата е откажана",
    "failedToCancel": "Неуспешно откажување на сесијата",
    "sessionDeleted": "Сесијата е избришана",
    "failedToDelete": "Неуспешно бришење на сесијата",
    "slotDeleted": "Редовниот термин е избришан",
    "trainerRemoved": "Тренерот е отстранет",
    "trainerAssigned": "Тренерот е доделен",
    "failedToUpdateTrainer": "Неуспешно ажурирање",
    "memberRemoved": "Членот е отстранет",
    "memberAssigned": "Членот е доделен",
    "failedToAssignMember": "Неуспешно доделување на член"
  },
  "assignment": {
    "assigned": "Доделен",
    "add": "Додај",
    "noPeopleAvailable": "Нема достапни лица."
  },
  "payments": {
    "title": "Плаќања",
    "subtitle": "Следете и забележувајте плаќања на членовите",
    "recordPayment": "Забележи плаќање",
    "editPayment": "Измени плаќање",
    "updatePayment": "Ажурирај плаќање",
    "deletePayment": "Избриши плаќање",
    "filterByMonth": "Филтрирај по месец",
    "filterByYear": "Филтрирај по година",
    "searchByName": "Пребарај по име...",
    "searchAriaLabel": "Пребарај плаќања по име на член",
    "thisMonth": "Овој месец",
    "allTime": "Сите времиња",
    "paidMembers": "Платени членови",
    "unpaid": "Неплатени",
    "unpaidMembers": "Неплатени членови",
    "unpaidMembersSubtitle": "Членови со неплатени обврски",
    "paymentHistory": "Историја на плаќања",
    "paymentsCount": "{count} плаќања",
    "paymentsInPeriod": "во {filterLabel}",
    "noPayments": "Сè уште нема забележани плаќања",
    "member": "Член",
    "amount": "Износ",
    "amountMKD": "Износ (МКД)",
    "amountPlaceholder": "пр. 1500",
    "period": "Период",
    "paid": "Платено",
    "paidAt": "Платено на",
    "periodStart": "Почеток на период",
    "periodEnd": "Крај на период",
    "notes": "Белешки (опционално)",
    "notesPlaceholder": "Дополнителни белешки...",
    "recordedBy": "Забележал",
    "selectMember": "Изберете член...",
    "editPaymentFor": "Измени плаќање за {memberName}",
    "deletePaymentFor": "Избриши плаќање за {memberName}",
    "deleteConfirmation": "Дали сте сигурни дека сакате да го избришете ова плаќање од {amount} за {memberName}? Оваа акција не може да се поништи.",
    "failedToRecord": "Неуспешно забележување на плаќање. Обидете се повторно.",
    "failedToUpdate": "Неуспешно ажурирање на плаќање",
    "failedToDelete": "Неуспешно бришење на плаќање"
  },
  "paymentStatus": {
    "paid": "Платено",
    "gracePeriod": "Грејс период",
    "locked": "Заклучено",
    "override": "Прескокнато",
    "departed": "Заминат"
  },
  "paymentBanner": {
    "paymentDue": "Плаќањето достасува.",
    "daysRemaining": "Имате уште {count, plural, one {# ден} other {# дена}} пред вашата сметка да биде заклучена. Платете кај тренерот или сопственикот на теретаната.",
    "lockedTomorrow": "Вашата сметка ќе биде заклучена утре. Платете кај тренерот или сопственикот на теретаната.",
    "accountLocked": "Сметката е заклучена.",
    "lockedMessage": "Вашиот пристап е ограничен додека не се прими плаќање. Контактирајте го сопственикот на теретаната."
  },
  "lockout": {
    "title": "Сметката е заклучена",
    "message": "Здраво {memberName}, вашата сметка е заклучена поради задоцнето плаќање. Пристапот до распоредот и присуството на часови е привремено ограничен.",
    "toRestore": "За да го вратите пристапот:",
    "step1": "1. Платете го месечниот надомест кај сопственикот на теретаната лично (само кеш)",
    "step2": "2. Сопственикот ќе го забележи плаќањето во системот",
    "step3": "3. Вашиот пристап ќе биде автоматски вратен",
    "contactOwner": "Прашања? Контактирајте {ownerEmail}",
    "logOut": "Одјави се"
  },
  "dashboard": {
    "title": "Контролна табла",
    "overview": "преглед",
    "activeMembers": "Активни членови",
    "revenue": "Приход",
    "outstanding": "Неплатени",
    "trials": "Проби",
    "onTrial": "на проба",
    "allMembersCurrent": "Сите членови се тековни",
    "noActiveTrials": "Нема активни проби",
    "graceAndLocked": "грејс, заклучени",
    "attendanceTracking": "Следење на присуство",
    "quickActions": "Брзи акции",
    "manageSchedule": "Управувај со распоред",
    "recordPayment": "Забележи плаќање",
    "privateSessionsLink": "Приватни сесии",
    "manageTrainers": "Управувај со тренери"
  },
  "notifications": {
    "title": "Известувања",
    "markAllRead": "Означи ги сите како прочитани",
    "noNotifications": "Нема известувања",
    "send": "Испрати известување",
    "sendTitle": "Испрати известување",
    "audience": "Публика",
    "allActiveMembers": "Сите активни членови",
    "trialMembersOnly": "Само членови на проба",
    "membersFromSlot": "Членови од термин за сесија",
    "membersByPaymentStatus": "Членови по статус на плаќање",
    "selectSpecific": "Избери конкретни членови",
    "sessionSlot": "Термин за сесија",
    "searchMembers": "Пребарај членови...",
    "sentToCount": "Известувањето е испратено до {count} член(ови)",
    "failedToSend": "Неуспешно испраќање на известување",
    "notificationTitle": "Наслов",
    "notificationBody": "Содржина"
  },
  "members": {
    "title": "Членови",
    "count": "{count} член(ови)",
    "addMember": "Додај член",
    "noMembers": "Сè уште нема членови",
    "name": "Име",
    "email": "Е-пошта",
    "phone": "Телефон",
    "status": "Статус",
    "joined": "Приклучен/а",
    "active": "Активен",
    "trial": "Проба",
    "departed": "Заминат"
  },
  "trainers": {
    "title": "Тренери",
    "count": "{count} тренер(и)",
    "addTrainer": "Додај тренер",
    "noTrainers": "Сè уште нема тренери",
    "name": "Име",
    "email": "Е-пошта",
    "phone": "Телефон",
    "phoneOptional": "Телефон (опционално)",
    "phonePlaceholder": "+389...",
    "status": "Статус",
    "added": "Додаден",
    "fullName": "Целосно име",
    "fullNamePlaceholder": "Целосно име на тренерот",
    "emailPlaceholder": "trener@example.com",
    "tempPasswordNote": "Тренерот ќе добие мејл со привремена лозинка за поставување на сметката.",
    "trainerCreated": "Тренерот е креиран",
    "trainerCreatedMessage": "Привремена лозинка е испратена на нивната е-пошта.",
    "failedToCreate": "Неуспешно креирање на тренер"
  },
  "privateSessions": {
    "title": "Приватни сесии",
    "previousMonth": "Претходен месец",
    "nextMonth": "Следен месец",
    "allSessions": "Сите сесии",
    "monthly": "Месечно",
    "newSession": "Нова сесија",
    "thisMonth": "Овој месец",
    "allTime": "Сите времиња",
    "totalSessions": "Вкупно сесии",
    "unpaid": "Неплатени",
    "sessionsLabel": "Сесии",
    "sessionsCount": "{count} сесии",
    "noSessions": "Сè уште нема приватни сесии",
    "client": "Клиент",
    "trainer": "Тренер",
    "date": "Датум",
    "amount": "Износ",
    "details": "Детали",
    "status": "Статус",
    "paid": "Платено",
    "newTitle": "Нова приватна сесија",
    "clientName": "Име на клиент",
    "clientNamePlaceholder": "Целосно име на клиентот",
    "scheduledAt": "Закажано на",
    "amountMKD": "Износ (МКД)",
    "amountPlaceholder": "пр. 500",
    "trainerSelect": "Тренер",
    "alreadyPaid": "Веќе платено",
    "exerciseDetails": "Детали за вежби (опционално)",
    "exerciseDetailsPlaceholder": "Опишете ги планираните вежби...",
    "notes": "Белешки (опционално)",
    "notesPlaceholder": "Дополнителни белешки...",
    "createSession": "Креирај сесија"
  },
  "profile": {
    "title": "Мој профил",
    "profileInformation": "Информации за профилот",
    "profileUpdated": "Профилот е ажуриран",
    "failedToUpdate": "Неуспешно ажурирање",
    "passwordChanged": "Лозинката е променета",
    "changePassword": "Промени лозинка",
    "currentPassword": "Тековна лозинка",
    "newPassword": "Нова лозинка",
    "confirmNewPassword": "Потврди нова лозинка"
  },
  "departed": {
    "greeting": "Ни недостигате, {userName}!",
    "message": "Вашата сметка е моментално деактивирана. Историјата на тренинзите и записите се безбедно зачувани.",
    "rejoinPrompt": "Подготвени да се вратите на тренинг? Испратете барање за повторно приклучување и сопственикот на теретаната ќе ја реактивира вашата сметка.",
    "rejoinSent": "Вашето барање за повторно приклучување е испратено! Сопственикот ќе го разгледа и ќе ви одговори.",
    "rejoinButton": "Барај повторно приклучување",
    "rejoinToastTitle": "Барањето е испратено",
    "rejoinToastMessage": "Сопственикот е известен за вашето барање.",
    "failedToSend": "Неуспешно испраќање на барањето"
  },
  "stopTraining": {
    "title": "Прекини со тренирање",
    "greeting": "Жалиме што заминувате, {userName}",
    "areYouSure": "Дали сте сигурни?",
    "deactivateWarning": "Ова ќе ја деактивира вашата сметка и ќе ве отстрани од сите идни сесии.",
    "whatHappens": "Што се случува кога заминувате:",
    "consequence1": "Ќе бидете отстранети од сите претстојни сесии",
    "consequence2": "Ќе го изгубите пристапот до распоредот и гласањето",
    "consequence3": "Историјата на плаќања и присуство ќе биде зачувана",
    "consequence4": "Можете да побарате повторно приклучување во секое време",
    "reasonLabel": "Причина за заминување (опционално)",
    "reasonPlaceholder": "Помогнете ни да се подобриме — зошто заминувате?",
    "reasonCharCount": "{count}/{max} карактери",
    "confirmCheckbox": "Разбирам дека ова ќе ја деактивира мојата сметка",
    "stopButton": "Прекини со тренирање",
    "accountDeactivated": "Вашата сметка е деактивирана",
    "failedToProcess": "Неуспешна обработка на барањето"
  },
  "dateRange": {
    "thisWeek": "Оваа недела",
    "thisMonth": "Овој месец",
    "last3Months": "Последни 3 месеци",
    "last6Months": "Последни 6 месеци",
    "thisYear": "Оваа година",
    "custom": "Прилагодено"
  }
}
```

**Step 2: Commit**

```bash
git add messages/mk.json
git commit -m "feat: add Macedonian translation file with all UI strings"
```

---

## Task 6: Update root layout with NextIntlClientProvider

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Update the root layout**

```typescript
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/Toast";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wonder Woman Fitness",
  description: "Studio management platform for Wonder Woman Fitness",
  openGraph: {
    title: "Wonder Woman Fitness",
    description: "Studio management platform for Wonder Woman Fitness",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-surface-950 text-surface-200 antialiased">
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Key changes:
- Import `NextIntlClientProvider`, `getLocale`, `getMessages`
- Make `RootLayout` async, return type `Promise<React.ReactElement>`
- Call `getLocale()` and `getMessages()`
- Set `<html lang={locale}>` dynamically
- Wrap `SessionProvider` + `ToastProvider` inside `NextIntlClientProvider`

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: wrap root layout with NextIntlClientProvider"
```

---

## Task 7: Set up vitest mock for next-intl

**Files:**
- Create: `test/mocks/next-intl.ts`
- Modify: `vitest.config.ts`

This is critical — the mock ensures all 1,860 existing tests keep passing by returning English translation keys as-is.

**Step 1: Create the next-intl mock**

```typescript
// test/mocks/next-intl.ts
import { vi } from "vitest";

// Mock translation function: returns the key itself (or interpolates simple values)
function createMockT(namespace?: string) {
  return (key: string, values?: Record<string, unknown>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    if (values) {
      // Simple interpolation for {variable} patterns
      let result = fullKey;
      for (const [k, v] of Object.entries(values)) {
        result = result.replace(`{${k}}`, String(v));
      }
      return result;
    }
    return fullKey;
  };
}

// Client-side hook mock
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createMockT(namespace),
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Server-side mock
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace?: string) => createMockT(namespace),
  getLocale: async () => "en",
  getMessages: async () => ({}),
}));
```

**Step 2: Add the mock to vitest setupFiles**

Update `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/mocks/next-intl.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

**Step 3: Run existing tests to verify mock works**

Run: `npm test`
Expected: All 1,860 tests pass. If any fail, the mock needs adjustment — most likely tests that assert on specific English text will now see translation keys instead. Those tests need to be updated in the component refactoring tasks.

**Important:** The mock returns translation keys (e.g., `"schedule.cancelled"`) not English text. Tests asserting on English text like `"Cancelled"` will fail until the component is refactored AND the test is updated. This is expected and will be resolved component-by-component in Tasks 9-20.

**Alternative approach if tests break:** If too many tests break at once, skip adding the mock to setupFiles for now. Instead, add the mock inline in each test file as you refactor it. Update `vitest.config.ts` setupFiles at the end when all components are done.

**Step 4: Commit**

```bash
git add test/mocks/next-intl.ts vitest.config.ts
git commit -m "test: add next-intl vitest mock for i18n support"
```

---

## Task 8: Create LanguageToggle component with test

**Files:**
- Create: `components/layout/LanguageToggle.tsx`
- Create: `components/layout/__tests__/LanguageToggle.test.tsx`

**Step 1: Write the failing test**

```typescript
// components/layout/__tests__/LanguageToggle.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageToggle } from "../LanguageToggle";

// Mock next-intl
vi.mock("next-intl", () => ({
  useLocale: () => "mk",
}));

// Mock document.cookie
const mockReload = vi.fn();
Object.defineProperty(window, "location", {
  value: { reload: mockReload },
  writable: true,
});

describe("LanguageToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "";
  });

  it("renders MK and EN buttons", () => {
    render(<LanguageToggle />);
    expect(screen.getByText("МК")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("highlights the current locale (mk)", () => {
    render(<LanguageToggle />);
    const mkButton = screen.getByText("МК");
    expect(mkButton.className).toContain("bg-primary");
  });

  it("switches to English when EN is clicked", () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByText("EN"));
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    expect(mockReload).toHaveBeenCalled();
  });

  it("does not reload when clicking the already-active locale", () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByText("МК"));
    expect(mockReload).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run components/layout/__tests__/LanguageToggle.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the LanguageToggle component**

```typescript
// components/layout/LanguageToggle.tsx
"use client";

import { useLocale } from "next-intl";

const localeOptions = [
  { code: "mk", label: "МК" },
  { code: "en", label: "EN" },
] as const;

export function LanguageToggle(): React.ReactElement {
  const currentLocale = useLocale();

  function switchLocale(newLocale: string): void {
    if (newLocale === currentLocale) return;
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    window.location.reload();
  }

  return (
    <div className="flex items-center rounded-lg border border-surface-700 overflow-hidden">
      {localeOptions.map((option) => (
        <button
          key={option.code}
          onClick={() => switchLocale(option.code)}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            currentLocale === option.code
              ? "bg-primary-600 text-white"
              : "bg-surface-800 text-surface-400 hover:text-surface-200"
          }`}
          aria-label={`Switch to ${option.code === "mk" ? "Macedonian" : "English"}`}
          aria-pressed={currentLocale === option.code}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run components/layout/__tests__/LanguageToggle.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add components/layout/LanguageToggle.tsx components/layout/__tests__/LanguageToggle.test.tsx
git commit -m "feat: add LanguageToggle component with MK/EN switch"
```

---

## Task 9: Add LanguageToggle to Header

**Files:**
- Modify: `components/layout/Header.tsx`

**Step 1: Import and place the LanguageToggle**

Add import at top of Header.tsx:
```typescript
import { LanguageToggle } from "./LanguageToggle";
```

Place `<LanguageToggle />` in the right-side controls area, between the notification bell and the user menu button. Find this section (around line 68):

```typescript
{/* Right side: notification bell + user menu */}
<div className="flex items-center gap-2">
```

Add `<LanguageToggle />` as the first child inside that div, before the notification bell Link:

```typescript
{/* Right side: language toggle + notification bell + user menu */}
<div className="flex items-center gap-2">
  <LanguageToggle />
  {/* Notification Bell */}
  <Link ...>
```

Also add the LanguageToggle to the mobile menu section. Find the mobile menu div (around line 179) and add before the profile/sign-out section:

```typescript
<div className="border-t border-surface-700 mt-2 pt-2">
  <div className="flex items-center justify-between px-3 py-2">
    <div className="flex items-center gap-3">
      {/* existing user avatar + name */}
    </div>
    <LanguageToggle />
  </div>
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "feat: add language toggle to Header for MK/EN switching"
```

---

## Task 10: Create date locale helper

**Files:**
- Create: `lib/date-locale.ts`

**Step 1: Create the helper**

```typescript
// lib/date-locale.ts
import { mk, enUS } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

export function getDateLocale(locale: string): DateFnsLocale {
  return locale === "mk" ? mk : enUS;
}
```

**Step 2: Commit**

```bash
git add lib/date-locale.ts
git commit -m "feat: add date-fns locale helper for i18n date formatting"
```

---

## Task 11: Refactor auth layout and auth pages

**Files:**
- Modify: `app/(auth)/layout.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/register/page.tsx`
- Modify: `app/(auth)/check-email/CheckEmailClient.tsx` (or equivalent)
- Modify: `app/(auth)/verify-email/page.tsx`
- Modify: `app/(auth)/forgot-password/page.tsx`

**Pattern for Server Components (auth layout):**

```typescript
// app/(auth)/layout.tsx
import { getTranslations } from "next-intl/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("brand");
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-400">{t("name")}</h1>
          <p className="mt-2 text-sm text-surface-400">{t("tagline")}</p>
        </div>
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Pattern for Client Components (login page):**

Add `import { useTranslations } from "next-intl";` at the top, then call `const t = useTranslations("auth");` inside the component, and replace every hardcoded string:

- `"Sign In"` → `{t("signIn")}`
- `"Email"` → `{t("email")}`
- `"Password"` → `{t("password")}`
- `"Invalid email or password"` → `t("invalidCredentials")`
- etc.

Apply the same pattern to all 5 auth pages. Each page uses its translation namespace:
- Login: `useTranslations("auth")`
- Register: `useTranslations("auth")` + `useTranslations("validation")`
- Check email: `useTranslations("auth")`
- Verify email: `useTranslations("auth")`
- Forgot password: `useTranslations("auth")`

**Step: Update tests for auth pages**

Tests that assert on English text (e.g., `screen.getByText("Sign In")`) need to either:
1. Mock `useTranslations` to return English text, OR
2. Update assertions to match translation keys

**Recommended approach**: Create a test helper that loads the real en.json and returns translations:

```typescript
// test/helpers/i18n.ts
import en from "@/messages/en.json";

type NestedMessages = { [key: string]: string | NestedMessages };

function getNestedValue(obj: NestedMessages, path: string): string {
  const parts = path.split(".");
  let current: string | NestedMessages = obj;
  for (const part of parts) {
    if (typeof current === "string") return path;
    current = current[part];
  }
  return typeof current === "string" ? current : path;
}

export function createTestTranslations(namespace: string) {
  const nsMessages = (en as NestedMessages)[namespace];
  return (key: string, values?: Record<string, unknown>): string => {
    const msg = typeof nsMessages === "object" ? (nsMessages as NestedMessages)[key] : key;
    let text = typeof msg === "string" ? msg : `${namespace}.${key}`;
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };
}
```

Then update the vitest mock in `test/mocks/next-intl.ts` to use real English translations instead of returning keys. This way existing test assertions on English text continue to pass.

**Step: Commit after each page is done**

```bash
git commit -m "feat: i18n auth layout and login page"
git commit -m "feat: i18n register, check-email, verify-email, forgot-password pages"
```

---

## Task 12: Refactor layout components (Header, Navigation)

**Files:**
- Modify: `components/layout/Header.tsx`
- Modify: `components/layout/Navigation.tsx`

**Header.tsx changes:**
- Add `import { useTranslations } from "next-intl";`
- Add `const t = useTranslations("navigation");` and `const tRoles = useTranslations("roles");`
- Replace `"Owner"` → `tRoles("owner")`, `"Trainer"` → `tRoles("trainer")`, `"Member"` → `tRoles("member")`
- Replace `"Profile"` → `t("profile")`, `"Sign out"` → `{t("signOut")}` (from auth namespace)
- Replace `"Toggle menu"` → `t("toggleMenu")`
- Replace `"Wonder Woman"` → `{tBrand("short")}` (from brand namespace)

**Navigation.tsx changes:**
- Add `import { useTranslations } from "next-intl";`
- Add `const t = useTranslations("navigation");` inside the component
- Replace hardcoded nav labels with translation calls. The `navLinks` object needs to use translation keys:

```typescript
// Before:
{ href: "/dashboard", label: "Dashboard", icon: icons.dashboard },

// After — use a function to build links:
export function Navigation({ role, mobile, onNavigate }: NavigationProps) {
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
    // ... TRAINER and MEMBER similarly
  };
  // ... rest of component
}
```

The `navLinks` must move inside the component body (after the `useTranslations` hook call) since it now depends on `t()`.

**Step: Update tests, commit**

```bash
git commit -m "feat: i18n Header and Navigation components"
```

---

## Task 13: Refactor payment components

**Files:**
- Modify: `components/payment/PaymentBanner.tsx` — uses `useTranslations("paymentBanner")`
- Modify: `components/payment/PaymentForm.tsx` — uses `useTranslations("payments")`
- Modify: `components/payment/PaymentHistory.tsx` — uses `useTranslations("payments")`
- Modify: `components/payment/PaymentStatusBadge.tsx` — uses `useTranslations("paymentStatus")`
- Modify: `components/payment/LockoutScreen.tsx` — uses `useTranslations("lockout")`

Apply the same pattern: import `useTranslations`, call it with the appropriate namespace, replace all hardcoded strings. Update corresponding test files.

**Step: Commit**

```bash
git commit -m "feat: i18n payment components (banner, form, history, badge, lockout)"
```

---

## Task 14: Refactor schedule components

**Files:**
- Modify: `components/schedule/SessionCard.tsx` — uses `getTranslations("schedule")` (server component)
- Modify: `components/schedule/VotingPrompt.tsx` — uses `useTranslations("schedule")`
- Modify: `components/schedule/CreateSessionModal.tsx` — uses `useTranslations("createSession")`
- Modify: `components/schedule/AttendanceChecklist.tsx` — uses `useTranslations("attendance")`
- Modify: `components/schedule/DeleteRecurringSlotModal.tsx` — uses `useTranslations("deleteSlot")`
- Modify: `components/schedule/WorkoutEditor.tsx` — uses `useTranslations("workout")`
- Modify: `components/schedule/WorkoutDisplay.tsx` — uses `useTranslations("workout")`
- Modify: `components/schedule/WeeklyCalendar.tsx` — uses `useTranslations("schedule")`
- Modify: `components/schedule/AssignmentToggleList.tsx` — uses `useTranslations("assignment")`

Note: SessionCard is a Server Component — use `getTranslations` (async) instead of `useTranslations`.

Also update date formatting in SessionCard to use the date locale helper:
```typescript
import { getLocale } from "next-intl/server";
import { getDateLocale } from "@/lib/date-locale";

// Inside the component:
const locale = await getLocale();
const dateLocale = getDateLocale(locale);
// Use dateLocale in format() calls
```

**Step: Commit**

```bash
git commit -m "feat: i18n schedule components (session card, voting, create, attendance)"
```

---

## Task 15: Refactor dashboard page

**Files:**
- Modify: `app/(owner)/dashboard/DashboardClient.tsx` — uses `useTranslations("dashboard")`

This is a large component with many strings. Use multiple translation namespaces if needed:
- `useTranslations("dashboard")` for metrics, labels, quick actions
- `useTranslations("dateRange")` for date range filter labels

**Step: Update tests, commit**

```bash
git commit -m "feat: i18n dashboard page"
```

---

## Task 16: Refactor notification components

**Files:**
- Modify: `components/notification/SendNotificationModal.tsx` — uses `useTranslations("notifications")`
- Modify: `components/notification/NotificationList.tsx` — uses `useTranslations("notifications")`
- Modify: `components/notification/NotificationBell.tsx` — (likely just aria-label)
- Modify: `components/notification/NotificationItem.tsx` — (if it has hardcoded text)
- Modify: any `NotificationsClient.tsx` page components

**Step: Commit**

```bash
git commit -m "feat: i18n notification components"
```

---

## Task 17: Refactor member pages

**Files:**
- Modify: `app/(member)/schedule/MemberScheduleClient.tsx` — uses `useTranslations("schedule")`
- Modify: `app/(member)/session/[id]/MemberSessionDetailClient.tsx` — uses `useTranslations("schedule")`
- Modify: `app/(member)/profile/ProfileClient.tsx` — uses `useTranslations("profile")`
- Modify: `app/(member)/departed/DepartedClient.tsx` — uses `useTranslations("departed")`
- Modify: `app/(member)/stop-training/StopTrainingClient.tsx` — uses `useTranslations("stopTraining")`

**Step: Commit**

```bash
git commit -m "feat: i18n member pages (schedule, profile, departed, stop-training)"
```

---

## Task 18: Refactor trainer pages

**Files:**
- Modify: `app/(trainer)/my-schedule/TrainerScheduleClient.tsx` — uses `useTranslations("schedule")`
- Modify: `app/(trainer)/session/[id]/TrainerSessionDetailClient.tsx` — uses `useTranslations("sessionDetail")`
- Modify: `app/(trainer)/payments/TrainerPaymentsClient.tsx` — uses `useTranslations("payments")`

**Step: Commit**

```bash
git commit -m "feat: i18n trainer pages (schedule, session detail, payments)"
```

---

## Task 19: Refactor owner pages (remaining)

**Files:**
- Modify: `app/(owner)/payments/PaymentsClient.tsx` — uses `useTranslations("payments")`
- Modify: `app/(owner)/private-sessions/PrivateSessionsClient.tsx` — uses `useTranslations("privateSessions")`
- Modify: `app/(owner)/trainers/TrainersClient.tsx` — uses `useTranslations("trainers")`
- Modify: `app/(owner)/schedule/ScheduleClient.tsx` — uses `useTranslations("schedule")`
- Modify: `app/(owner)/session/[id]/SessionDetailClient.tsx` — uses `useTranslations("sessionDetail")`
- Modify: `app/(owner)/notifications/NotificationsClient.tsx` — uses `useTranslations("notifications")`
- Modify: `app/(owner)/members/*` — uses `useTranslations("members")`

**Step: Commit**

```bash
git commit -m "feat: i18n owner pages (payments, private sessions, trainers, schedule, members)"
```

---

## Task 20: Refactor UI primitives

**Files:**
- Modify: `components/ui/ConfirmationModal.tsx` — `useTranslations("common")` for "Cancel" button
- Modify: `components/ui/DatePicker.tsx` — locale-aware day/month names
- Modify: `components/ui/DateTimePicker.tsx` — locale-aware day/month names, AM/PM
- Check: `components/ui/Toast.tsx`, `components/ui/Modal.tsx`, `components/ui/Button.tsx` — likely no hardcoded user-facing strings

For DatePicker and DateTimePicker, use the date locale helper and pass the current locale to date-fns format calls.

**Step: Commit**

```bash
git commit -m "feat: i18n UI primitives (ConfirmationModal, DatePicker, DateTimePicker)"
```

---

## Task 21: Refactor analytics components

**Files:**
- Modify: `components/analytics/DateRangeFilter.tsx` — uses `useTranslations("dateRange")`
- Modify: `components/analytics/AttendanceAnalytics.tsx` (or similar) — uses `useTranslations("dashboard")`
- Modify: `components/analytics/VoteVsActualCards.tsx`
- Modify: `components/analytics/MetricCard.tsx`
- Modify: `components/analytics/MemberAttendanceTable.tsx`

**Step: Commit**

```bash
git commit -m "feat: i18n analytics components"
```

---

## Task 22: Final test fix-up and verification

**Step 1: Run the full test suite**

Run: `npm test`

Fix any remaining test failures by updating assertions to match translated text or improving the mock.

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 3: Lint**

Run: `npm run lint`
Expected: No new warnings (5 pre-existing warnings OK)

**Step 4: Manual smoke test**

Run: `npm run dev`
- Visit login page — should show Macedonian text by default
- Click "EN" toggle — page reloads with English text
- Click "MK" toggle — back to Macedonian
- Navigate through owner, trainer, member views
- Check payment banner, voting UI, dashboard metrics
- Verify dates show in correct locale format

**Step 5: Final commit**

```bash
git commit -m "test: fix remaining test assertions for i18n support"
```

---

## Summary

| Phase | Tasks | What |
|-------|-------|------|
| Infrastructure | 1-3 | Install next-intl, create config, update next.config.ts |
| Translations | 4-5 | Create en.json and mk.json with all ~500 keys |
| Root Layout | 6 | Wrap app with NextIntlClientProvider |
| Testing Setup | 7 | Create vitest mock for next-intl |
| Language Toggle | 8-9 | Create component, add to Header |
| Date Helper | 10 | Create date-fns locale helper |
| Component i18n | 11-21 | Refactor all 56 components to use t() |
| Verification | 22 | Full test suite, type check, lint, smoke test |
