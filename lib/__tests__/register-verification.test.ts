import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  pendingVerification: {
    upsert: vi.fn(),
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
vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}));

describe('POST /api/auth/register (with verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  });

  it('creates a PendingVerification record instead of a User', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-1',
      email: 'test@example.com',
      token: 'test-token',
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.message).toContain('Verification email sent');
    expect(mockPrisma.pendingVerification.upsert).toHaveBeenCalled();
  });

  it('returns 400 when email already exists in User table', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'existing@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockPrisma.pendingVerification.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid input', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'not-an-email',
        password: 'short',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
