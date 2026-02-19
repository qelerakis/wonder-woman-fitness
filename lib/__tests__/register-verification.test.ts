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

  it('returns rate limit response when rate limit is exceeded', async () => {
    const { publicLimiter, createRateLimitResponse } = await import('@/lib/rate-limit');
    const rateLimitResponse = Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
    vi.mocked(publicLimiter.check).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60000,
    });
    vi.mocked(createRateLimitResponse).mockReturnValueOnce(rateLimitResponse);

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
    expect(res.status).toBe(429);
    expect(createRateLimitResponse).toHaveBeenCalledWith(60000);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('normalizes email to lowercase before lookup and storage', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-2',
      email: 'uppercase@example.com',
      token: 'test-token',
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'UpperCase@Example.COM',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    // User lookup should use lowercase email
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'uppercase@example.com' },
      select: { id: true },
    });

    // Upsert should use lowercase email
    const upsertCall = mockPrisma.pendingVerification.upsert.mock.calls[0][0];
    expect(upsertCall.where.email).toBe('uppercase@example.com');
    expect(upsertCall.create.email).toBe('uppercase@example.com');
  });

  it('upsert replaces existing pending record with reset resendCount', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-3',
      email: 're-register@example.com',
      token: 'new-token',
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Re-Register User',
        email: 're-register@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const upsertCall = mockPrisma.pendingVerification.upsert.mock.calls[0][0];
    // update should reset resendCount and clear lastResentAt
    expect(upsertCall.update.resendCount).toBe(0);
    expect(upsertCall.update.lastResentAt).toBeNull();
    // update should include new hashed password, name, token, expiresAt
    expect(upsertCall.update.passwordHash).toBe('hashed-password');
    expect(upsertCall.update.name).toBe('Re-Register User');
    expect(upsertCall.update.token).toBeDefined();
    expect(upsertCall.update.expiresAt).toBeDefined();
  });

  it('registers successfully without phone (phone stored as null)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-4',
      email: 'nophone@example.com',
      token: 'test-token',
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Phone User',
        email: 'nophone@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const upsertCall = mockPrisma.pendingVerification.upsert.mock.calls[0][0];
    expect(upsertCall.create.phone).toBeNull();
    expect(upsertCall.update.phone).toBeNull();
  });

  it('registers successfully with phone number included', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-5',
      email: 'withphone@example.com',
      token: 'test-token',
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phone User',
        email: 'withphone@example.com',
        password: 'Password1!',
        phone: '+389 70 123 456',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const upsertCall = mockPrisma.pendingVerification.upsert.mock.calls[0][0];
    expect(upsertCall.create.phone).toBe('+389 70 123 456');
    expect(upsertCall.update.phone).toBe('+389 70 123 456');
  });

  it('calls sendVerificationEmail with correct email and token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-6',
      email: 'verify@example.com',
      token: 'test-token',
    });

    const { sendVerificationEmail } = await import('@/lib/email');

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Verify User',
        email: 'Verify@Example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    // Should be called with normalized email and a token string
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(sendVerificationEmail).mock.calls[0];
    expect(callArgs[0]).toBe('verify@example.com');
    expect(typeof callArgs[1]).toBe('string');
    expect(callArgs[1].length).toBeGreaterThan(0);
  });

  it('returns 201 even when sendVerificationEmail throws (fire-and-forget)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.pendingVerification.upsert.mockResolvedValue({
      id: 'pv-7',
      email: 'emailfail@example.com',
      token: 'test-token',
    });

    const { sendVerificationEmail } = await import('@/lib/email');
    vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error('SMTP connection failed'));

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email Fail User',
        email: 'emailfail@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    // Email sending is fire-and-forget — registration succeeds even if email fails
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message).toContain('Verification email sent');
  });

  it('returns 500 when prisma throws an error', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection lost'));

    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'DB Error User',
        email: 'dberror@example.com',
        password: 'Password1!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
    expect(mockPrisma.pendingVerification.upsert).not.toHaveBeenCalled();
  });

  it('returns 500 when request body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json{{{',
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('returns 400 when extra fields are present (strict schema)', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'extra@example.com',
        password: 'Password1!',
        isAdmin: true,
        role: 'OWNER',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.pendingVerification.upsert).not.toHaveBeenCalled();
  });
});
