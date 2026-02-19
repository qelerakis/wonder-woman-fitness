import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  pendingVerification: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/rate-limit', () => ({
  publicLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 9, retryAfterMs: 0 }) },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  createRateLimitResponse: vi.fn(),
}));

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  it('resends verification email for valid pending record', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      token: 'old-token',
      expiresAt: futureDate,
      resendCount: 0,
      lastResentAt: null,
    });
    mockPrisma.pendingVerification.update.mockResolvedValue({
      id: 'pv-1',
      token: 'new-token',
    });

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.pendingVerification.update).toHaveBeenCalled();
  });

  it('returns generic 200 when no pending record exists (no enumeration)', async () => {
    mockPrisma.pendingVerification.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.pendingVerification.update).not.toHaveBeenCalled();
  });

  it('returns 429 when cooldown has not elapsed', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const recentResent = new Date(Date.now() - 10000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      expiresAt: futureDate,
      resendCount: 1,
      lastResentAt: recentResent,
    });

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 429 when max resends reached', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      expiresAt: futureDate,
      resendCount: 5,
      lastResentAt: new Date(Date.now() - 120000),
    });

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid email format', async () => {
    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-valid' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
