import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  pendingVerification: {
    deleteMany: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/cron-auth', () => ({
  verifyCronSecret: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/rate-limit', () => ({
  cronLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 4, retryAfterMs: 0 }) },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  createRateLimitResponse: vi.fn(),
}));

describe('GET /api/cron/cleanup-pending', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore default mock return values after clearAllMocks resets them
    const { cronLimiter } = await import('@/lib/rate-limit');
    const { verifyCronSecret } = await import('@/lib/cron-auth');
    vi.mocked(cronLimiter.check).mockReturnValue({ allowed: true, remaining: 4, retryAfterMs: 0 });
    vi.mocked(verifyCronSecret).mockReturnValue(true);
  });

  it('deletes expired pending verifications', async () => {
    mockPrisma.pendingVerification.deleteMany.mockResolvedValue({ count: 3 });

    const { GET } = await import('@/app/api/cron/cleanup-pending/route');
    const req = new Request('http://localhost:3000/api/cron/cleanup-pending', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.deleted).toBe(3);
    expect(mockPrisma.pendingVerification.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('returns 401 with invalid cron secret', async () => {
    const { verifyCronSecret } = await import('@/lib/cron-auth');
    vi.mocked(verifyCronSecret).mockReturnValue(false);

    const { GET } = await import('@/app/api/cron/cleanup-pending/route');
    const req = new Request('http://localhost:3000/api/cron/cleanup-pending', {
      headers: { authorization: 'Bearer wrong' },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { cronLimiter, createRateLimitResponse } = await import('@/lib/rate-limit');
    vi.mocked(cronLimiter.check).mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 5000 });
    vi.mocked(createRateLimitResponse).mockReturnValue(
      Response.json({ error: 'Too many requests' }, { status: 429 })
    );

    const { GET } = await import('@/app/api/cron/cleanup-pending/route');
    const req = new Request('http://localhost:3000/api/cron/cleanup-pending', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    expect(res.status).toBe(429);
    expect(createRateLimitResponse).toHaveBeenCalledWith(5000);
  });

  it('returns 500 on database error', async () => {
    mockPrisma.pendingVerification.deleteMany.mockRejectedValue(new Error('DB error'));

    const { GET } = await import('@/app/api/cron/cleanup-pending/route');
    const req = new Request('http://localhost:3000/api/cron/cleanup-pending', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('handles zero expired records gracefully', async () => {
    mockPrisma.pendingVerification.deleteMany.mockResolvedValue({ count: 0 });

    const { GET } = await import('@/app/api/cron/cleanup-pending/route');
    const req = new Request('http://localhost:3000/api/cron/cleanup-pending', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.deleted).toBe(0);
    expect(data.data.message).toBe('Cleanup complete');
  });
});
