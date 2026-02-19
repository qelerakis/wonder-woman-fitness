import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend before importing — use a function constructor (not arrow)
// so it works with `new Resend(...)`.
const mockSend = vi.fn().mockResolvedValue({ id: 'test-id' });

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

describe('sendVerificationEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
    mockSend.mockReset().mockResolvedValue({ id: 'test-id' });
  });

  it('sends email with verification link containing the token', async () => {
    const { sendVerificationEmail } = await import('../email');
    const result = await sendVerificationEmail('test@example.com', 'abc123token');
    expect(result).toBe(true);
  });

  it('returns false when RESEND_API_KEY is not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const { sendVerificationEmail } = await import('../email');
    const result = await sendVerificationEmail('test@example.com', 'abc123token');
    expect(result).toBe(false);
  });

  it('returns false when email send throws', async () => {
    mockSend.mockRejectedValue(new Error('Send failed'));
    const { sendVerificationEmail } = await import('../email');
    const result = await sendVerificationEmail('test@example.com', 'token');
    expect(result).toBe(false);
  });
});
