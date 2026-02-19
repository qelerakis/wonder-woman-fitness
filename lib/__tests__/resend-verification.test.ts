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

  it('returns rate limit response when publicLimiter denies request', async () => {
    const { publicLimiter, createRateLimitResponse } = await import('@/lib/rate-limit');
    const mockRateLimitResponse = Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
    vi.mocked(publicLimiter.check).mockReturnValueOnce({ allowed: false, remaining: 0, retryAfterMs: 5000 });
    vi.mocked(createRateLimitResponse).mockReturnValueOnce(mockRateLimitResponse);

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(createRateLimitResponse).toHaveBeenCalledWith(5000);
  });

  it('normalizes email to lowercase before lookup', async () => {
    mockPrisma.pendingVerification.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'TEST@Example.COM' }),
    });

    await POST(req);
    expect(mockPrisma.pendingVerification.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
  });

  it('treats expired record the same as not found (generic 200)', async () => {
    const pastDate = new Date(Date.now() - 86400000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      token: 'old-token',
      expiresAt: pastDate,
      resendCount: 0,
      lastResentAt: null,
    });

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.pendingVerification.update).not.toHaveBeenCalled();
  });

  it('allows resend when cooldown has elapsed (> 60s)', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const oldResent = new Date(Date.now() - 90_000); // 90 seconds ago
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      token: 'old-token',
      expiresAt: futureDate,
      resendCount: 1,
      lastResentAt: oldResent,
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

  it('increments resendCount by 1 in the update call', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      token: 'old-token',
      expiresAt: futureDate,
      resendCount: 3,
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

    await POST(req);
    expect(mockPrisma.pendingVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pv-1' },
        data: expect.objectContaining({
          resendCount: 4,
        }),
      })
    );
  });

  it('sends verification email with the new token, not the old one', async () => {
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

    await POST(req);

    const { sendVerificationEmail } = await import('@/lib/email');
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String)
    );
    // The token passed to sendVerificationEmail should NOT be the old token
    const callArgs = vi.mocked(sendVerificationEmail).mock.calls[0];
    expect(callArgs[1]).not.toBe('old-token');
  });

  it('returns 500 when Prisma findUnique throws an error', async () => {
    mockPrisma.pendingVerification.findUnique.mockRejectedValue(
      new Error('Database connection failed')
    );

    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('returns 500 when request body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('returns 400 when extra fields are included (strict schema)', async () => {
    const { POST } = await import('@/app/api/auth/resend-verification/route');
    const req = new Request('http://localhost:3000/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', extraField: 'should-fail' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
