# Product Requirements Document (PRD)

## Wonder Woman Fitness — Studio Management Platform

| Field              | Detail                                      |
|--------------------|---------------------------------------------|
| **Product Name**   | Wonder Woman Fitness                        |
| **Version**        | 1.0 (MVP) — Feature Complete                |
| **Platform**       | Web Application                             |
| **Author**         | —                                           |
| **Last Updated**   | February 14, 2026                           |
| **Status**         | Complete — All MVP features implemented     |
| **Domain**         | wonderwomanfitness.mk                       |

---

## 1. Overview

### 1.1 Elevator Pitch

Wonder Woman Fitness is a web-based studio management platform built for a boutique fitness business. It replaces the fragmented workflow of managing classes via Instagram DMs, Facebook polls, and manual cash tracking with a single, purpose-built application. The owner gets a command center for scheduling, memberships, payments, and analytics. Members get a clean interface to view workouts, vote on attendance, and stay connected to their fitness community.

### 1.2 Problem Statement

The gym owner currently manages her business across multiple disconnected tools: Instagram for member communication, Facebook for attendance polls, and manual tracking for payments. This leads to missed messages, lost payment records, no analytics, and a fragmented member experience. No existing off-the-shelf fitness app adapts to her specific business model — instead, they force the business to adapt to the software.

### 1.3 Goals

- Consolidate all studio operations (scheduling, attendance, payments, communication) into one platform.
- Give the owner real-time visibility into business health through an analytics dashboard.
- Provide members with a seamless experience for viewing workouts, confirming attendance, and staying informed.
- Establish a premium, branded digital presence that strengthens community identity.
- Build a maintainable platform that can evolve with new features over time.

### 1.4 Target Users

| Role        | Description                                                                                     |
|-------------|-------------------------------------------------------------------------------------------------|
| **Owner**   | The gym owner / administrator. Full control over scheduling, members, payments, and analytics.   |
| **Trainer** | Fitness instructors with their own accounts. Can post workouts and track member attendance.      |
| **Member**  | Gym members who view schedules, see workouts, vote on attendance, and manage their own profile.  |

### 1.5 Branding

- **Name**: Wonder Woman Fitness
- **Color Palette**: Purple and black (primary), with complementary accent colors for UI states (success, warning, error).
- **Vibe**: Strong, premium, community-driven.

---

## 2. User Roles & Permissions

### 2.1 Owner (Admin)

The owner has unrestricted access to every feature in the platform.

| Capability                        | Details                                                                 |
|-----------------------------------|-------------------------------------------------------------------------|
| Manage schedule                   | Create, edit, delete training sessions                                  |
| Assign trainers                   | Add/remove trainers from any session                                    |
| Manage members                    | Add, remove, view, and edit member profiles                             |
| Post workouts                     | Write and publish workout details for sessions                          |
| Toggle voting                     | Enable/disable attendance voting per session                            |
| Move/reassign members             | Move members between groups (with or without confirmation)              |
| Cancel classes                    | Cancel sessions, triggering automatic notifications                     |
| Manage payments                   | Record cash payments, track amounts, dates, discounts, advance payments |
| Send payment reminders            | Manually trigger or rely on automated reminders for unpaid members      |
| Schedule private sessions         | Book 1-on-1 sessions with clients outside of group classes              |
| View analytics dashboard          | Access all business metrics and member insights                         |

### 2.2 Trainer

Trainers have their own login credentials and a scoped set of permissions.

| Capability                        | Details                                                       |
|-----------------------------------|---------------------------------------------------------------|
| Post workouts                     | Write and publish workout details for their assigned sessions  |
| View assigned sessions            | See schedule for sessions they are assigned to                 |
| Track member attendance           | View which members are in their sessions and attendance status |
| View member payment status        | See which members are paid, unpaid, or overdue to assist with cash collection |

### 2.3 Member

Members have a consumer-facing experience focused on viewing and interacting.

| Capability                        | Details                                                        |
|-----------------------------------|----------------------------------------------------------------|
| View schedule                     | See weekly class schedule and assigned time slots               |
| View workouts                     | See workout details for current and future weeks (if posted)    |
| Vote on attendance                | Vote "coming" or "not coming" when voting is enabled            |
| View group members                | See which other members are in their class group                |
| Manage profile                    | Update name, phone, email, photo                                |
| Receive notifications             | Get email and web notifications for relevant events             |

---

## 3. Feature Specifications

### 3.1 Authentication & Onboarding

**Registration**: Members self-register on the website. Trainers and the owner account are created during initial setup or by the owner directly.

**Login**: Email and password authentication for all roles.

**Acceptance Criteria**:
- Members can register with name, phone, email, and password.
- Upon registration, members are in an "active" state and can browse the app.
- Owner can create trainer accounts from the admin panel.
- Passwords must meet minimum security requirements (8+ characters, at least one number and one special character).
- Users can reset their password via email.

---

### 3.2 Schedule Management

The schedule follows a **recurring weekly structure** — the same time slots repeat every week. Workouts assigned to those slots change on a weekly basis. Time slots run from **7:00 AM to 11:00 PM**, with each slot lasting **one hour** (16 possible slots per day).

**Owner Capabilities**:
- Define recurring weekly time slots (e.g., Monday 9:00 AM, Monday 10:00 AM, etc.).
- Create, edit, and delete individual training sessions within those slots.
- Assign one or more trainers to a session.
- Add or remove members from a session.
- Cap each class at a maximum of **20 members**.

**Workout Posting**:
- The owner or assigned trainer can write workout details for each session.
- Workouts can be posted for the **entire week at once** or individually.
- Members can see workouts for **future weeks** if the owner/trainer has published them.

**Acceptance Criteria**:
- The schedule displays as a weekly calendar view with hourly time slots.
- Each session card shows: time, trainer name, workout summary, member count / cap, and voting status.
- Owner can bulk-post workouts for a full week.
- Trainers can only post workouts to sessions they are assigned to.
- Members see a read-only view of the schedule with workout details.

**Edge Cases**:
- If a session is deleted that has members assigned, all affected members must be notified.
- If a trainer is removed from a session that has a workout posted, the workout remains visible.

---

### 3.3 Attendance Voting System

The owner can open a voting window on any session, allowing members to indicate whether they plan to attend.

**Voting Rules**:
- Voting options: **"I'm coming"** / **"I'm not coming"**.
- Voting deadline: **one day before** the class.
- After the deadline, voting is locked.

**Low Attendance Handling** (1–2 "coming" votes):
The owner has two options:
1. **Move with confirmation**: Notify the affected members that they are being moved to a different group. Members receive a notification and can see the proposed change. **The move is final** — the original class remains cancelled regardless of whether the member prefers the new slot.
2. **Force move**: The owner moves members to another group without requiring confirmation. Members are notified of the change.
3. **Cancel the class**: The session is cancelled. All members who voted "coming" are **automatically notified** via email and web notification.

> **Note**: Once the owner decides to move members or cancel a class, the decision is final. The original class will stay cancelled and the member will be notified of their new assignment.

**Acceptance Criteria**:
- Owner can toggle voting on/off per session.
- Members see a clear voting prompt on sessions where voting is enabled.
- After the deadline, the vote button is disabled and results are visible to the owner.
- Owner can see a summary of votes (who's coming, who's not, who hasn't voted).
- When the owner moves a member, the member receives a notification specifying the new session. The move is final and does not require member confirmation.
- Cancelled sessions are visually marked and members are notified within minutes.

**Edge Cases**:
- A member who hasn't voted by the deadline is treated as "not coming."
- If a member is moved to a group that is already at capacity (20), the system should block the move and alert the owner.
- If voting is disabled mid-vote, existing votes are preserved but no new votes can be cast.

---

### 3.4 Membership & Payment Management

All payments are **cash-only**. The owner manually records payments in the app when a member pays in person.

#### 3.4.1 Payment Tracking

| Field              | Details                                                        |
|--------------------|----------------------------------------------------------------|
| **Amount**         | Variable per member (supports discounts and custom pricing)    |
| **Date**           | Date the payment was received                                  |
| **Status**         | Paid / Unpaid / Overdue                                        |
| **Period**         | Which month(s) the payment covers                              |
| **Advance Payment**| Members can pay for multiple months in advance                 |

**Acceptance Criteria**:
- Owner can record a payment with: member name, amount, date, and the month(s) it covers.
- Owner can set custom monthly amounts per member (to accommodate discounts).
- Owner can record advance payments covering 2+ months in a single transaction.
- Payment history is stored and viewable per member.
- The system automatically calculates each member's payment status at the start of each month.

#### 3.4.2 Payment Enforcement & Grace Period

The payment cycle resets on the **1st of each month**. There is a **10-day grace period** to maintain a positive user experience, since payments are collected in cash.

| Day of Month  | Member Status if Unpaid                                                              |
|---------------|--------------------------------------------------------------------------------------|
| Day 1–10      | **Grace period**: Member sees a non-blocking banner reminding them to pay. Full app access remains. |
| Day 11+       | **Locked out**: Member is fully locked out of the app and sees only a "Pay your membership" screen. |

**Automated Notifications**:
- **Day 1**: If unpaid, a gentle reminder notification (email + web) is sent.
- **Day 7**: If still unpaid, a stronger reminder is sent warning of upcoming lockout.
- **Day 11**: Lockout notification sent. Member sees only the payment banner.
- Owner can also **manually trigger** a payment reminder to any member at any time.

**Acceptance Criteria**:
- Members who have paid (including advance payments) see no banners and have full access.
- The grace period banner is visible but non-intrusive (does not block navigation).
- After day 10, unpaid members are hard-locked: they cannot view the schedule, workouts, or vote.
- The lockout screen displays a clear message and instructions to pay in person.
- Owner can override lockout manually if needed (e.g., special arrangement with a member).
- Advance payments correctly prevent lockout for future covered months.

**Edge Cases**:
- A member who pays on day 10 should immediately regain full access upon the owner recording the payment.
- If a member paid for 3 months in advance, the system should not show any payment banners for the next 2 months.
- Mid-month new members: the system should prorate or the owner should have the option to mark the first month as paid.

---

### 3.5 Private Training Sessions

The owner can schedule one-on-one private training sessions outside of the regular group class schedule.

| Field              | Required | Details                                    |
|--------------------|----------|--------------------------------------------|
| **Client name**    | Yes      | Name of the client (may or may not be a registered member) |
| **Date & time**    | Yes      | Scheduled date and time of the session     |
| **Payment status** | Yes      | Paid / Unpaid (paid on the spot, cash)     |
| **Exercise details**| No      | Optional workout plan or notes             |
| **Notes**          | No       | Any additional notes from the owner        |

**Acceptance Criteria**:
- Owner can create, edit, and delete private sessions from a dedicated section.
- Private sessions appear on the owner's calendar but are **not visible** to other members.
- Owner can mark a private session as paid/unpaid.
- Optional fields (exercise details, notes) can be left blank.
- Private sessions are included in revenue analytics.

---

### 3.6 Notifications System

Notifications are delivered via **two channels**: email and in-app web notifications.

| Trigger                                   | Recipient(s)       | Channel         |
|-------------------------------------------|---------------------|-----------------|
| Workout posted for the week               | All members          | Email + Web     |
| Voting opened on a session                | Members in that group| Email + Web     |
| Class cancelled                           | Members who voted "coming" | Email + Web |
| Member moved to another group (with confirmation) | Affected member | Email + Web |
| Member moved to another group (force move)| Affected member      | Email + Web     |
| Payment reminder (automated, day 1)       | Unpaid members       | Email + Web     |
| Payment reminder (automated, day 7)       | Unpaid members       | Email + Web     |
| Lockout notification (day 11)             | Unpaid members       | Email           |
| Manual payment reminder                   | Selected member(s)   | Email + Web     |
| Session deleted with assigned members     | Affected members     | Email + Web     |
| Slot opened up (after cancellation/move)  | Waitlisted or group members | Email + Web |
| Member deactivated ("stopped training")   | Owner                  | Email + Web     |
| Member requests reactivation ("Rejoin")   | Owner                  | Email + Web     |
| Trial expiring in 2 days                  | Owner                  | Email + Web     |
| Trial expired — payment now required      | Member                 | Email + Web     |

**Acceptance Criteria**:
- All notifications are sent within 5 minutes of the triggering event.
- Email notifications include clear subject lines and action links back to the app.
- Web notifications appear as a badge/bell icon in the app header with a dropdown of recent notifications.
- Members can view a notification history page.
- Notification delivery failures (bounced emails) are logged for the owner to review.

---

### 3.7 Member Profile

| Field          | Required | Editable By       |
|----------------|----------|-------------------|
| **Name**       | Yes      | Member, Owner      |
| **Phone**      | Yes      | Member, Owner      |
| **Email**      | Yes      | Member, Owner      |
| **Join date**  | Yes      | System (auto-set)  |
| **Photo**      | No       | Member, Owner      |

**Acceptance Criteria**:
- Members can edit their own profile from a settings/profile page.
- Owner can view and edit any member's profile from the admin panel.
- Join date is automatically set on registration and cannot be edited.
- Photo upload supports JPEG and PNG, max 5 MB.

---

### 3.8 Member Departure (Cancel Membership)

Members can voluntarily indicate that they are no longer training. This is a soft-deactivation, not an account deletion.

**Member Actions**:
- A member can mark themselves as "no longer training" from their profile settings.
- They can optionally provide a reason/description for leaving.
- Upon deactivation, the member loses access to all app features (schedule, voting, workouts).
- Instead of a lockout screen, they see a **motivational banner**: a warm message that the community is waiting for them to come back, with an option to reactivate.

**Owner Actions**:
- The owner is notified immediately when a member deactivates.
- Departed members appear in a dedicated "Inactive Members" section in the admin panel, showing: name, departure date, and reason (if provided).
- The owner can use this for personal outreach and follow-up.
- Departed members are **excluded** from payment tracking, payment reminders, and projected earnings.
- The owner can reactivate a member's account if they return.

**Acceptance Criteria**:
- The "Stop training" action requires a confirmation dialog ("Are you sure?") before processing.
- Reason field is optional, supports free text up to 500 characters.
- Upon deactivation, the member is automatically removed from all future class groups and voting.
- The motivational banner includes a "Rejoin" button that sends a reactivation request to the owner.
- Departed members do not count toward class capacity or analytics (attendance, retention) going forward.
- Owner can view a history of all departures with dates and reasons.

**Edge Cases**:
- If a member deactivates mid-month and has already paid, no refund logic is needed (cash-based, handled offline).
- If a departed member clicks "Rejoin," the owner must approve the reactivation before access is restored.
- Departed members' historical data (attendance, payments) is preserved for analytics purposes.

---

### 3.9 Trial Period for New Members

New members receive a **2-week free trial** upon registration before their first payment is due.

**Rules**:
- The trial begins on the member's registration date (join date).
- During the trial, the member has **full access** to all member features: schedule, workouts, voting, notifications.
- No payment banners or reminders are shown during the trial period.
- On the day the trial expires, the member transitions to the standard payment cycle:
  - They are treated as if it is "day 1" of their first payment month.
  - The 10-day grace period applies from the trial expiration date for their first month only. Subsequent months follow the standard 1st-of-month cycle.

**Owner Visibility**:
- Trial members are visually tagged in the members list (e.g., "Trial — 5 days left").
- The owner receives a notification when a member's trial is about to expire (2 days before).
- The owner can see a list of all currently active trial members on the dashboard.

**Acceptance Criteria**:
- Trial period is exactly 14 days from the registration date.
- The system automatically transitions the member from trial to active (payment required) status.
- Trial members are excluded from payment reminders and lockout logic.
- Owner can manually end a trial early or extend it if needed.
- Trial members appear in attendance analytics but are excluded from payment/revenue analytics until their trial ends.

**Edge Cases**:
- If a trial member decides to pay before the trial ends, the owner can record the payment and the trial ends early.
- If a trial member deactivates ("stop training") during the trial, standard departure flow applies.

---

### 3.10 Analytics Dashboard (Owner Only)

The analytics dashboard gives the owner a real-time view of business health and member engagement.

#### 3.10.1 Member Engagement Metrics

| Metric                    | Description                                                  |
|---------------------------|--------------------------------------------------------------|
| **Most consistent members** | Ranked list of members by attendance rate over a selected period |
| **Least consistent members**| Members with the lowest attendance rates                     |
| **Attendance trends**      | Weekly/monthly attendance over time (line chart)             |

#### 3.10.2 Class Performance Metrics

| Metric                    | Description                                                  |
|---------------------------|--------------------------------------------------------------|
| **Class fill rate**        | Average percentage of spots filled per class                 |
| **Most popular time slots**| Time slots with the highest average attendance               |
| **Cancellation rate**      | Percentage of classes cancelled due to low attendance         |

#### 3.10.3 Financial Metrics

| Metric                    | Description                                                  |
|---------------------------|--------------------------------------------------------------|
| **Revenue per month**      | Total cash collected per month (group + private sessions)    |
| **Late payers**            | List of members who consistently pay after day 1             |
| **Outstanding payments**   | Total unpaid amount for the current month                    |
| **Payment timeline**       | Distribution of when members typically pay each month        |

#### 3.10.4 Retention Metrics

| Metric                    | Description                                                  |
|---------------------------|--------------------------------------------------------------|
| **Member retention rate**  | Percentage of members who remain active month-over-month     |
| **Churn rate**             | Percentage of members who leave or become inactive           |
| **Average member lifespan**| Average number of months a member stays enrolled             |

**Acceptance Criteria**:
- Dashboard loads within 3 seconds.
- All metrics support date-range filtering (this week, this month, last 3 months, last 6 months, this year, custom range).
- Charts are interactive (hover for details).
- Owner can export analytics data as CSV.
- Metrics update in real-time as payments are recorded and attendance is tracked.

---

## 4. User Stories

### 4.1 Owner Stories

| ID     | Story                                                                                                          | Priority |
|--------|----------------------------------------------------------------------------------------------------------------|----------|
| O-01   | As an owner, I want to define my weekly recurring schedule so that I don't have to recreate time slots every week. | Must     |
| O-02   | As an owner, I want to create and delete training sessions so that I can manage my weekly offerings.             | Must     |
| O-03   | As an owner, I want to assign trainers to sessions so that members know who is leading the class.                | Must     |
| O-04   | As an owner, I want to post workouts for an entire week at once so that members can plan ahead.                  | Must     |
| O-05   | As an owner, I want to enable voting on a session so that I know who is planning to attend.                      | Must     |
| O-06   | As an owner, I want to move members from a low-attendance class to another group so that I can consolidate sessions. | Must |
| O-07   | As an owner, I want to cancel a class and have members automatically notified so that no one shows up to an empty session. | Must |
| O-08   | As an owner, I want to record a cash payment for a member so that their account reflects the correct status.     | Must     |
| O-09   | As an owner, I want to record advance payments for multiple months so that members who pay ahead are correctly tracked. | Must |
| O-10   | As an owner, I want unpaid members to be locked out after 10 days so that I can enforce payment deadlines.       | Must     |
| O-11   | As an owner, I want to see a dashboard with attendance, payment, and retention analytics so that I can make informed business decisions. | Must |
| O-12   | As an owner, I want to schedule private training sessions and track their payment status.                        | Must     |
| O-13   | As an owner, I want to send manual payment reminders to specific members.                                        | Must     |
| O-14   | As an owner, I want to manage member profiles (add, edit, remove) from an admin panel.                           | Must     |
| O-15   | As an owner, I want to override the lockout for a specific member if we have a special arrangement.              | Should   |
| O-16   | As an owner, I want to export analytics data as CSV for external reporting.                                      | Should   |
| O-17   | As an owner, I want to be notified when a member deactivates so that I can reach out to them personally.         | Must     |
| O-18   | As an owner, I want to see a list of departed members with their reasons so that I can identify patterns.        | Must     |
| O-19   | As an owner, I want departed members excluded from payments and projected earnings so that my financials are accurate. | Must |
| O-20   | As an owner, I want to reactivate a departed member's account when they return.                                  | Must     |
| O-21   | As an owner, I want to see which members are on their free trial and when it expires so that I can follow up.    | Must     |
| O-22   | As an owner, I want to be notified 2 days before a member's trial expires so that I can encourage them to stay.  | Must     |

### 4.2 Trainer Stories

| ID     | Story                                                                                                          | Priority |
|--------|----------------------------------------------------------------------------------------------------------------|----------|
| T-01   | As a trainer, I want to log in with my own account so that I have a personal workspace.                         | Must     |
| T-02   | As a trainer, I want to post workouts for my assigned sessions so that members can see what we'll be doing.      | Must     |
| T-03   | As a trainer, I want to view the members in my assigned sessions so that I can prepare for the class.            | Must     |
| T-04   | As a trainer, I want to see attendance voting results for my sessions so that I know how many people to expect.  | Should   |
| T-05   | As a trainer, I want to see the payment status of members so that I can collect cash payments on behalf of the owner. | Must     |

### 4.3 Member Stories

| ID     | Story                                                                                                          | Priority |
|--------|----------------------------------------------------------------------------------------------------------------|----------|
| M-01   | As a member, I want to register on the website so that I can join the gym community.                            | Must     |
| M-02   | As a member, I want to view the weekly schedule and workouts so that I know what's coming up.                    | Must     |
| M-03   | As a member, I want to vote on whether I'm attending a session so that the owner can plan accordingly.           | Must     |
| M-04   | As a member, I want to see which other members are in my class group so that I feel part of a community.         | Must     |
| M-05   | As a member, I want to receive email and web notifications for important updates (cancellations, schedule changes, reminders). | Must |
| M-06   | As a member, I want to see future weeks' workouts if they've been posted so that I can plan ahead.               | Must     |
| M-07   | As a member, I want to update my profile (name, phone, email, photo) so that my information is current.          | Must     |
| M-08   | As a member, I want to see a gentle reminder if I haven't paid, without being locked out immediately.            | Must     |
| M-09   | As a member, I want to be notified if I'm moved to a different group so that I know my new schedule.             | Must     |
| M-10   | As a member, I want to be notified when I'm moved to a different group so that I know my new schedule (the move is final). | Must     |
| M-11   | As a member, I want to mark myself as "no longer training" with an optional reason so that the owner knows I've left. | Must |
| M-12   | As a departed member, I want to see a motivational banner and a "Rejoin" button so that I can come back easily.  | Must     |
| M-13   | As a new member, I want a 2-week free trial so that I can experience the gym before committing to payment.       | Must     |

---

## 5. Scope

### 5.1 In Scope (v1 — MVP)

- Web application (responsive, mobile-friendly)
- Three user roles: Owner, Trainer, Member
- Email + password authentication with self-registration for members
- Recurring weekly schedule management with hourly time slots
- Weekly workout posting (bulk and individual)
- Attendance voting system with deadline enforcement
- Member move (with confirmation) and force-move between groups
- Class cancellation with automatic notifications
- Cash payment tracking (amount, date, status, advance payments, discounts)
- 10-day grace period with progressive lockout enforcement
- Automated email + web notifications for payments, cancellations, and schedule changes
- Private training session scheduling and payment tracking
- Member profiles (name, phone, email, join date, optional photo)
- Owner analytics dashboard (engagement, class performance, financials, retention)
- Single-gym architecture (one owner, one business)
- 2-week free trial for new members with automatic transition to paid status
- Member voluntary departure with optional reason, motivational banner, and rejoin flow
- Domain: wonderwomanfitness.mk

### 5.2 Out of Scope (Future Versions)

- Native mobile apps (iOS / Android)
- Online payment processing (Stripe, PayPal, etc.)
- Multi-gym / multi-tenant support
- In-app messaging or chat between members
- Exercise library or video content
- Wearable device integrations
- Automated workout programming / AI recommendations
- Public-facing marketing website or landing page
- Member-to-member social features (comments, reactions)
- Integration with third-party calendar apps (Google Calendar, Apple Calendar)
- SMS notifications
- Multi-language support

---

## 6. Recommended Tech Stack

| Layer            | Technology                          | Rationale                                                    |
|------------------|--------------------------------------|--------------------------------------------------------------|
| **Frontend**     | Next.js (React) + Tailwind CSS       | Fast, SEO-friendly, responsive. Tailwind pairs well with a custom purple/black brand. |
| **Backend**      | Next.js API Routes or Node.js (Express) | Unified stack with the frontend. Simple to deploy and maintain. |
| **Database**     | PostgreSQL                           | Relational data (members, payments, sessions) fits naturally. Robust and scalable. |
| **ORM**          | Prisma                               | Type-safe database access, excellent migration tooling.       |
| **Auth**         | NextAuth.js (Auth.js)                | Built-in email/password support, session management, role-based access. |
| **Email**        | Resend or SendGrid                   | Transactional email delivery for notifications and reminders. |
| **Notifications**| Web Push API + in-app notification system | Real-time web notifications via the browser.              |
| **File Storage** | Cloudinary or AWS S3                 | Member photo uploads.                                         |
| **Hosting**      | Vercel (frontend) + Railway/Render (DB) | Low-ops deployment, scales easily, generous free tiers.    |
| **Scheduling**   | node-cron or Vercel Cron Jobs        | Automated payment reminders on day 1, 7, and 11.             |
| **Analytics**    | Recharts or Chart.js                 | Interactive, lightweight charting for the owner dashboard.    |

---

## 7. Non-Functional Requirements

| Requirement        | Target                                                             |
|--------------------|--------------------------------------------------------------------|
| **Performance**    | Pages load within 2 seconds. Dashboard loads within 3 seconds.     |
| **Availability**   | 99.5% uptime.                                                     |
| **Security**       | Passwords hashed (bcrypt). HTTPS enforced. Role-based access control on all endpoints. |
| **Responsiveness** | Fully responsive design. Optimized for mobile browsers since most members will access from their phones. |
| **Data Backup**    | Daily automated database backups with 30-day retention.            |
| **Scalability**    | Single-gym scope, but clean architecture to allow future expansion if needed. |
| **Accessibility**  | WCAG 2.1 AA compliance for core user flows.                       |

---

## 8. Key Screens (Wireframe Guide)

This section outlines the primary screens to be designed and built.

### Owner Views
1. **Dashboard** — Analytics overview with key metrics, charts, and quick actions.
2. **Schedule Manager** — Weekly calendar view with session cards. Create/edit/delete sessions.
3. **Session Detail** — Assign trainers, manage members, post workouts, toggle voting, view votes.
4. **Members List** — Searchable/filterable table of all members with payment status indicators.
5. **Member Detail** — Profile info, payment history, attendance history, actions (send reminder, override lockout).
6. **Payment Manager** — Record payments, view outstanding, filter by status.
7. **Private Sessions** — List and create private training sessions.
8. **Trainer Management** — Create/manage trainer accounts.
9. **Notifications Center** — View sent notifications and delivery status.
10. **Inactive Members** — List of departed members with departure date, reason, and reactivation action.
11. **Trial Members** — List of members currently on trial with days remaining.

### Trainer Views
1. **My Schedule** — Weekly view showing only assigned sessions.
2. **Session Detail** — Post/edit workouts, view members with payment status indicators, and voting results.

### Member Views
1. **Weekly Schedule** — Calendar view with workouts, trainer info, and voting buttons.
2. **Session Detail** — Full workout details, list of group members, vote action.
3. **My Profile** — Edit personal info and photo.
4. **Notifications** — List of received notifications.
5. **Payment Banner** — Non-blocking reminder (days 1–10) or full lockout screen (day 11+).
6. **Stop Training** — Confirmation dialog with optional reason field.
7. **Departed State** — Motivational banner ("The community is waiting for you!") with a "Rejoin" button.

---

## 9. Risks & Mitigations

| Risk                                          | Impact | Mitigation                                                       |
|-----------------------------------------------|--------|------------------------------------------------------------------|
| Owner forgets to record cash payments          | High   | Automated reminders to the owner for members with no recorded payment after day 5. |
| Members don't check the app regularly          | Medium | Email notifications ensure members are informed even if they don't open the app. |
| Low voter turnout makes voting unreliable       | Medium | Treat "no vote" as "not coming" to give the owner a conservative headcount. |
| Email deliverability issues                     | Medium | Use a reputable email provider (Resend/SendGrid) and monitor bounce rates. |
| Single point of failure (one admin)             | Low    | Consider adding a "manager" role in a future version.            |

---

## 10. Success Metrics

| Metric                                   | Target (3 months post-launch)        |
|------------------------------------------|--------------------------------------|
| Owner no longer uses Instagram/Facebook for class management | 100%                    |
| Members actively voting on sessions       | 80%+ of assigned members vote        |
| On-time payment rate (paid by day 10)     | 90%+                                 |
| Owner time spent on admin tasks           | Reduced by 50% compared to current workflow |
| Member satisfaction (qualitative feedback)| Positive                             |

---

## 11. Resolved Questions

| #  | Question                                                                                    | Resolution |
|----|---------------------------------------------------------------------------------------------|------------|
| 1  | Should trainers be able to see payment status of members, or is that owner-only?             | **Yes** — trainers can see payment status since they also handle cash collection. |
| 2  | What is the maximum number of time slots per day?                                            | **16 slots** — from 7:00 AM to 11:00 PM, one hour each. |
| 3  | Should members be able to delete their own accounts, or only the owner?                      | Members can **deactivate** ("stop training") with an optional reason. They see a motivational banner and can request to rejoin. The owner is notified for personal outreach. Departed members are excluded from payments and projected earnings. |
| 4  | Is there a preferred domain name for the web app?                                            | **wonderwomanfitness.mk** |
| 5  | Should the app support a "trial" period for new members before their first payment is due?   | **Yes** — 2-week free trial with full access. After trial, standard payment cycle begins with a 10-day grace period for the first month. |
| 6  | What happens if a member's move is declined — does the original class stay cancelled?        | **The move is final.** The original class stays cancelled and the member is notified of their new assignment. |

---

---

## 12. Implementation Status (as of February 14, 2026)

All MVP features defined in this PRD have been implemented and tested. The application is feature-complete and production-ready.

### Implemented Features

| Feature Area | Status | Notes |
|---|---|---|
| Authentication & Registration | Done | NextAuth v5, JWT strategy, credentials provider |
| Schedule Management | Done | Recurring slots + one-off custom sessions |
| Workout Posting | Done | Per-session workout editor for owner/trainer |
| Attendance Voting | Done | 24h deadline, inline voting modal for members |
| Payment Tracking | Done | Computed status (never stored), grace period, lockout |
| Private Sessions | Done | Full CRUD, payment tracking |
| Notifications | Done | 12 types, email + in-app, 3 automated cron jobs |
| Member Profile | Done | Edit name, phone, email, photo (Cloudinary) |
| Member Departure | Done | Voluntary departure, motivational banner, rejoin flow |
| Trial Period | Done | 14-day trial, auto-transition, owner notifications |
| Analytics Dashboard | Done | Engagement, class performance, revenue, retention charts |
| Session Assignments | Done | Owner assigns trainers/members, carry-forward on week generation |
| Delete Recurring Slot | Done | Cascade option to delete future sessions |

### Post-MVP Additions (Built Beyond Original PRD)

These features were added during development to address real workflow needs:

1. **One-Off Custom Sessions** — Sessions not tied to a recurring slot (e.g., special events, makeup classes). Uses `customDay` + `customStartHour` fields on Session.
2. **Trainer Schedule Access** — Trainers can create recurring slots and one-off sessions (not just post workouts).
3. **Session Assignment Management** — Inline toggle lists for assigning trainers and members to individual sessions. Members see all sessions with visual distinction for assigned vs. available.
4. **Carry-Forward Assignments** — When generating a new week, trainer and member assignments are automatically copied from the previous week's matching slots. Departed members are excluded.
5. **Delete Recurring Slot with Cascade** — Owner can delete a recurring slot and optionally delete all future sessions generated from it.
6. **Member Voting Redesign** — Inline voting modal (no page navigation). Assigned sessions have green tint styling. SessionCard adapts rendering by role.

### Tech Stack (Actual Versions)

| Layer | Technology | Actual Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.12 |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS | 4.1.18 |
| Database | PostgreSQL (Neon) | 16 |
| ORM | Prisma | 7.4.0 (adapter pattern) |
| Auth | NextAuth.js | v5 beta.30 |
| Email | Resend | Latest |
| File Storage | Cloudinary | Latest |
| Charts | Recharts | 2.x |
| Validation | Zod | 3.x |
| Testing | Vitest | Latest |
| Hosting | Vercel + Neon | — |

### Test Coverage

358 automated tests across 15 test files, all passing (~3.7s):
- Business logic: 103 tests (payment, voting, session generation, carry-forward)
- API routes: 200 tests (members, sessions, payments, votes, assignments, private sessions, recurring slots)
- UI components: 55 tests (Modal, CreateSessionModal, session schemas, SessionCard, VoteModal, MemberScheduleClient)

---

*This PRD is a living document and should be updated as decisions are made on open questions and as the product evolves.*
