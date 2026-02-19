import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  pendingVerification: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

describe('verifyEmailToken (logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates user and deletes pending record for valid token', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'test@example.com',
      passwordHash: 'hashed',
      name: 'Test User',
      phone: '+38970123456',
      token: 'valid-token',
      expiresAt: futureDate,
      resendCount: 0,
      lastResentAt: null,
      createdAt: new Date(),
    };

    mockPrisma.pendingVerification.findUnique.mockResolvedValue(pendingRecord);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      return fn(mockPrisma);
    });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
    mockPrisma.pendingVerification.delete.mockResolvedValue(pendingRecord);

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('valid-token');

    expect(result.success).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.pendingVerification.delete).toHaveBeenCalled();
  });

  it('returns error for expired token', async () => {
    const pastDate = new Date(Date.now() - 86400000);
    mockPrisma.pendingVerification.findUnique.mockResolvedValue({
      id: 'pv-1',
      token: 'expired-token',
      expiresAt: pastDate,
    });

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('expired-token');

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('returns error for unknown token', async () => {
    mockPrisma.pendingVerification.findUnique.mockResolvedValue(null);

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('unknown-token');

    expect(result.success).toBe(false);
  });
});
