# Wonder Woman Fitness - Production Deployment Guide

## Prerequisites

- [Vercel Account](https://vercel.com) (free tier works)
- [Neon Database](https://neon.tech) account (production database)
- [Resend Account](https://resend.com) (email service)
- [Cloudinary Account](https://cloudinary.com) (file uploads)
- Domain name (wonderwomanfitness.org) configured

---

## Step 1: Neon Production Database Setup

1. **Create Production Database**
   - Go to [Neon Console](https://console.neon.tech)
   - Click "New Project"
   - Name: `wonder-woman-fitness-prod`
   - Region: Choose closest to your users (EU Central for Macedonia)
   - Copy the connection string (starts with `postgresql://`)

2. **Enable Connection Pooling**
   - In project settings → Connection pooling → Enable
   - Use pooled connection string for `DATABASE_URL`

3. **Run Migrations**
   ```bash
   # Set DATABASE_URL to production database
   export DATABASE_URL="postgresql://..."

   # Run migrations
   npx prisma migrate deploy

   # Generate Prisma client
   npx prisma generate
   ```

4. **Enable Daily Backups**
   - Project settings → Backups → Enable automatic daily backups

---

## Step 2: Vercel Project Setup

1. **Create Vercel Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Framework Preset: Next.js
   - Root Directory: `./`

2. **Configure Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Set Environment Variables**

   Go to **Project Settings → Environment Variables** and add:

   | Name | Value | Where to Get |
   |------|-------|--------------|
   | `DATABASE_URL` | `postgresql://...` | Neon connection string (pooled) |
   | `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` | Generate locally |
   | `NEXTAUTH_URL` | `https://wonderwomanfitness.org` | Your production domain |
   | `RESEND_API_KEY` | `re_...` | Resend Dashboard → API Keys |
   | `EMAIL_FROM` | `noreply@wonderwomanfitness.org` | Your verified domain |
   | `CLOUDINARY_CLOUD_NAME` | Your cloud name | Cloudinary Dashboard |
   | `CLOUDINARY_API_KEY` | Your API key | Cloudinary Dashboard |
   | `CLOUDINARY_API_SECRET` | Your API secret | Cloudinary Dashboard |
   | `CRON_SECRET` | Run: `openssl rand -base64 32` | Generate locally |

   **Important**: Set all variables for **Production** environment.

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)
   - Note the deployment URL (e.g., `wonder-woman-fitness.vercel.app`)

---

## Step 3: Resend Email Setup

1. **Add Custom Domain**
   - Go to [Resend Dashboard](https://resend.com/domains)
   - Click "Add Domain"
   - Enter: `wonderwomanfitness.org`

2. **Configure DNS Records**

   Add these records to your domain DNS:

   **SPF Record** (TXT):
   ```
   Name: @
   Type: TXT
   Value: v=spf1 include:_spf.resend.com ~all
   ```

   **DKIM Records** (provided by Resend):
   ```
   Name: resend._domainkey
   Type: TXT
   Value: <provided by Resend>
   ```

   **DMARC Record** (TXT):
   ```
   Name: _dmarc
   Type: TXT
   Value: v=DMARC1; p=none; rua=mailto:dmarc@wonderwomanfitness.org
   ```

3. **Verify Domain**
   - Click "Verify" in Resend dashboard
   - Wait for DNS propagation (~15 minutes to 24 hours)
   - Status should show "Verified" with green checkmark

4. **Test Email Delivery**
   ```bash
   curl -X POST https://yourdomain.vercel.app/api/test-email \
     -H "Content-Type: application/json" \
     -d '{"to": "your-email@example.com"}'
   ```

---

## Step 4: Custom Domain Configuration

1. **Add Domain to Vercel**
   - Project Settings → Domains
   - Add: `wonderwomanfitness.org`
   - Add: `www.wonderwomanfitness.org` (redirects to apex)

2. **Configure DNS Records**

   **Apex Domain** (A Record):
   ```
   Name: @
   Type: A
   Value: 76.76.21.21
   ```

   **WWW Subdomain** (CNAME):
   ```
   Name: www
   Type: CNAME
   Value: cname.vercel-dns.com
   ```

3. **Wait for DNS Propagation**
   - Check status in Vercel dashboard
   - Should show "Valid Configuration" within 24 hours

4. **Enable HTTPS**
   - Vercel automatically provisions SSL certificate
   - HTTPS is enforced by default

**Domain Redirects:** `vercel.json` includes 301 redirects from `www.wonderwomanfitness.org` and all `*.vercel.app` subdomains to the apex domain `wonderwomanfitness.org`.

---

## Step 5: Cron Jobs Verification

1. **Check Cron Configuration**
   - Vercel Dashboard → Project → Cron Jobs
   - Should show 4 cron jobs from `vercel.json`:
     - Payment reminders (daily 9 AM)
     - Trial expiration (daily 6 AM)
     - Voting deadline (daily midnight)
     - Cleanup pending verifications (daily 3 AM)

2. **Test Cron Endpoints**

   **Manual Trigger** (for testing):
   ```bash
   # Replace $CRON_SECRET with your actual secret

   # Test payment reminders
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://wonderwomanfitness.org/api/cron/payment-reminders

   # Test trial expiration
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://wonderwomanfitness.org/api/cron/trial-expiration

   # Test voting deadline
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://wonderwomanfitness.org/api/cron/voting-deadline

   # Test cleanup pending verifications
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://wonderwomanfitness.org/api/cron/cleanup-pending
   ```

3. **Monitor Cron Logs**
   - Vercel Dashboard → Deployment → Functions
   - Check logs for cron executions
   - Should show successful runs with no errors

---

## Step 6: Production Data Setup

1. **Create Owner Account**

   **Option A: Via Seed Script** (recommended for first setup)
   ```bash
   # Connect to production database
   export DATABASE_URL="postgresql://..."

   # Run seed script
   npx prisma db seed
   ```

   **Option B: Manual Registration + Database Update**
   ```sql
   -- After registering via /register, update user role to OWNER
   UPDATE "User"
   SET role = 'OWNER', status = 'ACTIVE'
   WHERE email = 'owner@wonderwomanfitness.org';
   ```

2. **Change Default Password**
   - Login to production site
   - Navigate to Profile → Change Password
   - Set a strong password (min 12 characters)

3. **Create Real Recurring Slots**
   - Owner Dashboard → Schedule → Create Recurring Slot
   - Add gym's actual schedule (e.g., Mon 9 AM, Wed 6 PM, Fri 9 AM)

4. **Delete Test Data**
   ```sql
   -- Delete seed test members (keep owner only)
   DELETE FROM "User" WHERE role = 'MEMBER' AND email LIKE '%@example.com';
   DELETE FROM "User" WHERE role = 'TRAINER' AND email LIKE '%@example.com';
   ```

---

## Step 7: Production Smoke Test

Run through this checklist to verify everything works:

- [ ] **Registration**: New member can register → receives TRIAL status
- [ ] **Login**: All roles (owner, trainer, member) can login
- [ ] **Schedule**: Owner creates recurring slot → sessions appear
- [ ] **Workouts**: Trainer posts workout → members receive email notification
- [ ] **Voting**: Member votes "coming" → vote is saved
- [ ] **Payments**: Owner records payment → member payment history updates
- [ ] **Lockout**: Create test member, set joinDate to 30 days ago, verify lockout works
- [ ] **Emails**: Check inbox for all notification types
- [ ] **Mobile**: Test on physical mobile device (iOS + Android)
- [ ] **Analytics**: Owner dashboard shows metrics and charts

**Test Emails**:
- Workout posted ✓
- Voting opened ✓
- Class cancelled ✓
- Payment reminder ✓

**Test Cron Jobs** (check Vercel logs after 24 hours):
- Payment reminders sent on days 1, 7, 11 ✓
- Trial expiration notifications ✓
- Voting deadlines enforced ✓
- Expired pending verifications cleaned up ✓

---

## Step 8: Post-Launch Monitoring

### Week 1 Checklist:

1. **Error Tracking**
   - Vercel Dashboard → Deployment → Functions → Errors
   - Check daily for errors
   - Set up error alerts (Vercel Pro feature)

2. **Performance Monitoring**
   - Vercel Analytics → Performance
   - Check P95 response times (should be < 1s)
   - Identify slow API routes

3. **Email Deliverability**
   - Resend Dashboard → Analytics
   - Monitor bounce rate (should be < 2%)
   - Check spam reports (should be 0)

4. **Database Usage**
   - Neon Dashboard → Usage
   - Monitor storage and compute usage
   - Verify backups are running daily

5. **Cron Job Execution**
   - Vercel Cron Jobs → Logs
   - Verify all 4 cron jobs run on schedule
   - Check for failed executions

### Ongoing Maintenance:

- **Weekly**: Review error logs, check email delivery rates
- **Monthly**: Database backup restore test, review analytics for insights
- **Quarterly**: Update dependencies (`npm outdated`), security audit

---

## Rollback Plan (If Critical Bug Found)

1. **Immediate Rollback**
   - Vercel Dashboard → Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"
   - Takes effect immediately (< 30 seconds)

2. **Database Rollback** (if needed)
   - Neon Dashboard → Backups
   - Select backup from before issue occurred
   - Click "Restore"
   - Update `DATABASE_URL` in Vercel if restored to new database

3. **Notify Users**
   - Send email to all members via owner notification system
   - Explain downtime and expected resolution time

---

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is strong (32+ characters, randomly generated)
- [ ] `CRON_SECRET` is strong and different from `NEXTAUTH_SECRET`
- [ ] Database connection uses SSL (`?sslmode=require`)
- [ ] All API routes verify session before processing
- [ ] Passwords hashed with bcrypt (12 rounds minimum)
- [ ] No secrets hardcoded in codebase (all in env vars)
- [ ] Cloudinary uploads always go through API route (never client-direct)
- [ ] CORS not disabled (Next.js defaults are secure)
- [ ] Rate limiting active on all API endpoints (in-memory sliding-window)
- [ ] Content-Security-Policy header enabled (XSS mitigation)
- [ ] All Zod schemas use `.strict()` (rejects unexpected fields)
- [ ] Cron auth uses timing-safe comparison (`crypto.timingSafeEqual`)

---

## Troubleshooting Common Issues

### Emails Not Sending
- Check Resend domain verification status (must show "Verified")
- Verify DNS records (SPF, DKIM, DMARC) are correct
- Check Resend API key is set in Vercel env vars
- Test with Resend's "Send Test Email" feature

### Cron Jobs Not Running
- Verify `CRON_SECRET` is set in Vercel env vars
- Check `vercel.json` syntax (must be valid JSON)
- Ensure cron paths match actual API routes
- Free tier has limits (100 cron executions/day)

### Database Connection Errors
- Verify `DATABASE_URL` uses pooled connection string
- Check Neon database is not paused (free tier pauses after 7 days inactivity)
- Verify SSL mode is enabled (`?sslmode=require`)
- Check Neon project region matches Vercel deployment region

### Payment Lockout Not Working
- Verify `getPaymentStatus()` is called on every member request
- Verify the member layout Server Component (app/(member)/layout.tsx) calls getPaymentStatus() and redirects to /member/locked when status is LOCKED
- Note: Middleware does NOT enforce lockout (edge runtime cannot access Prisma). Lockout is enforced at the layout level.
- Verify `GRACE_PERIOD_DAYS` constant is set correctly (10 days)
- Test with manual date change (create member with old joinDate)

---

## Known Limitations

### In-Memory Rate Limiting
The rate limiter (`lib/rate-limit.ts`) uses an in-memory `Map` for storing request counts. On Vercel's serverless platform, each function instance has its own memory space. This means:

- Rate limits provide **per-instance burst protection** only
- Concurrent requests to different instances may bypass the limit
- Rate limit state is lost on cold starts

**For a single-gym app with low traffic, this is acceptable.** If you need stronger protection:
- Use [Upstash Redis](https://upstash.com/) with `@upstash/ratelimit` (free tier: 10,000 requests/day)
- Or enable Vercel WAF/Firewall rules (Pro plan) to rate-limit at the edge

---

## Support & Feedback

- **GitHub Issues**: https://github.com/your-repo/issues
- **Owner Email**: owner@wonderwomanfitness.org
- **Emergency Contact**: [Your phone number]

---

## Next Steps After Launch

1. **Invite Members**
   - Share registration link: `https://wonderwomanfitness.org/register`
   - Send invitation emails with trial benefits (14 days free)

2. **Onboard Trainers**
   - Owner creates trainer accounts with temporary passwords
   - Trainers receive email with login credentials
   - Trainers forced to change password on first login

3. **Set Up Private Sessions**
   - Owner adds private training clients
   - Track paid/unpaid status

4. **Monitor Analytics**
   - Weekly review of attendance trends
   - Monthly revenue tracking
   - Retention rate monitoring

---

**Deployment Date**: _____________________
**Deployed By**: _____________________
**Production URL**: https://wonderwomanfitness.org
**Version**: 1.0.0
