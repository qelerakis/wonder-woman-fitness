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

  // ----- Email template HTML coverage -----

  describe('email template HTML content', () => {
    it('sends with subject "Verify your email — Wonder Woman Fitness"', async () => {
      const { sendVerificationEmail } = await import('../email');
      await sendVerificationEmail('test@example.com', 'abc123token');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Verify your email — Wonder Woman Fitness',
        })
      );
    });

    it('sends with the correct from address using EMAIL_FROM', async () => {
      const { sendVerificationEmail } = await import('../email');
      await sendVerificationEmail('test@example.com', 'abc123token');

      // EMAIL_FROM defaults to 'noreply@wonderwomanfitness.mk' when env is not set
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('wonderwomanfitness'),
        })
      );
    });

    it('HTML contains the full verification URL with token', async () => {
      const { sendVerificationEmail } = await import('../email');
      await sendVerificationEmail('test@example.com', 'abc123token');

      const callArgs = mockSend.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain(
        'http://localhost:3000/verify-email?token=abc123token'
      );
    });

    it('HTML contains "Verify Email" button text', async () => {
      const { sendVerificationEmail } = await import('../email');
      await sendVerificationEmail('test@example.com', 'abc123token');

      const callArgs = mockSend.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain('Verify Email');
    });

    it('HTML contains expiry message mentioning 24 hours', async () => {
      const { sendVerificationEmail } = await import('../email');
      await sendVerificationEmail('test@example.com', 'abc123token');

      const callArgs = mockSend.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain('24 hours');
    });

    it('HTML escapes XSS in token', async () => {
      const { sendVerificationEmail } = await import('../email');
      await sendVerificationEmail('test@example.com', '<script>alert(1)</script>');

      const callArgs = mockSend.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain('&lt;script&gt;');
      expect(callArgs.html).not.toContain('<script>alert(1)</script>');
    });

    it('HTML contains brand name "Wonder Woman Fitness"', async () => {
      const { sendVerificationEmail } = await import('../email');
      await sendVerificationEmail('test@example.com', 'abc123token');

      const callArgs = mockSend.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain('Wonder Woman Fitness');
    });
  });
});
