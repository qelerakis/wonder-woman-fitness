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

  it('creates user with MEMBER role and TRIAL status', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'member@example.com',
      passwordHash: 'hashed-pw',
      name: 'New Member',
      phone: '+38970111222',
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
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'member@example.com' });
    mockPrisma.pendingVerification.delete.mockResolvedValue(pendingRecord);

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    await verifyEmailToken('valid-token');

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'MEMBER',
          status: 'TRIAL',
        }),
      })
    );
  });

  it('sets trialEndsAt approximately 14 days from now', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'trial@example.com',
      passwordHash: 'hashed-pw',
      name: 'Trial User',
      phone: '+38970111333',
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
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'trial@example.com' });
    mockPrisma.pendingVerification.delete.mockResolvedValue(pendingRecord);

    const beforeCall = new Date();
    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    await verifyEmailToken('valid-token');

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    const trialEndsAt = new Date(createCall.data.trialEndsAt).getTime();
    const expectedTrialEnd = beforeCall.getTime() + 14 * 24 * 60 * 60 * 1000;
    // Allow 5 seconds tolerance for test execution time
    expect(Math.abs(trialEndsAt - expectedTrialEnd)).toBeLessThan(5000);
  });

  it('sets joinDate to approximately now', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'joined@example.com',
      passwordHash: 'hashed-pw',
      name: 'Joined User',
      phone: '+38970111444',
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
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'joined@example.com' });
    mockPrisma.pendingVerification.delete.mockResolvedValue(pendingRecord);

    const beforeCall = Date.now();
    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    await verifyEmailToken('valid-token');

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    const joinDate = new Date(createCall.data.joinDate).getTime();
    // Allow 5 seconds tolerance
    expect(Math.abs(joinDate - beforeCall)).toBeLessThan(5000);
  });

  it('passes phone from pending record to user.create', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'phone@example.com',
      passwordHash: 'hashed-pw',
      name: 'Phone User',
      phone: '+38970999888',
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
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'phone@example.com' });
    mockPrisma.pendingVerification.delete.mockResolvedValue(pendingRecord);

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    await verifyEmailToken('valid-token');

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+38970999888',
        }),
      })
    );
  });

  it('passes email from pending record to user.create', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'specific@example.com',
      passwordHash: 'hashed-pw',
      name: 'Email User',
      phone: '+38970111555',
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
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'specific@example.com' });
    mockPrisma.pendingVerification.delete.mockResolvedValue(pendingRecord);

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    await verifyEmailToken('valid-token');

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'specific@example.com',
        }),
      })
    );
  });

  it('returns failure when user.create throws (e.g. duplicate email)', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'duplicate@example.com',
      passwordHash: 'hashed-pw',
      name: 'Duplicate User',
      phone: '+38970111666',
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
    mockPrisma.user.create.mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`email`)')
    );

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('valid-token');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns failure when pendingVerification.delete throws', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'delete-fail@example.com',
      passwordHash: 'hashed-pw',
      name: 'Delete Fail User',
      phone: '+38970111777',
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
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'delete-fail@example.com' });
    mockPrisma.pendingVerification.delete.mockRejectedValue(
      new Error('Record to delete does not exist')
    );

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('valid-token');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('does not expose internal error details in catch block response', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const pendingRecord = {
      id: 'pv-1',
      email: 'error@example.com',
      passwordHash: 'hashed-pw',
      name: 'Error User',
      phone: '+38970111888',
      token: 'valid-token',
      expiresAt: futureDate,
      resendCount: 0,
      lastResentAt: null,
      createdAt: new Date(),
    };

    mockPrisma.pendingVerification.findUnique.mockResolvedValue(pendingRecord);
    mockPrisma.$transaction.mockRejectedValue(
      new Error('FATAL: connection to server at "neon-db.com" failed: SQLSTATE 08001')
    );

    const { verifyEmailToken } = await import('@/app/(auth)/verify-email/actions');
    const result = await verifyEmailToken('valid-token');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Should not contain internal error details like connection strings or SQL state codes
    expect(result.error).not.toContain('neon-db.com');
    expect(result.error).not.toContain('SQLSTATE');
    expect(result.error).not.toContain('FATAL');
  });
});
