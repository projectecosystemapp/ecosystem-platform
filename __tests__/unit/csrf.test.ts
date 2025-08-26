import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { generateCSRFToken, createSignedToken, verifySignedToken, requiresCSRFProtection, shouldSkipCSRF, csrfCookieOptions } from '@/lib/security/csrf';
import crypto from 'crypto';

// Mock crypto.timingSafeEqual for consistent testing
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  timingSafeEqual: jest.fn((a, b) => a.equals(b)),
}));

describe('CSRF Protection Utilities (lib/security/csrf.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set a consistent CSRF_SECRET for testing
    process.env = { ...originalEnv, CSRF_SECRET: 'test_csrf_secret_12345678901234567890' };
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original env
  });

  it('should throw an error if CSRF_SECRET is missing or too short', () => {
    process.env.CSRF_SECRET = undefined;
    expect(() => require('@/lib/security/csrf')).toThrow('CSRF_SECRET environment variable is required and must be at least 32 characters.');
    
    jest.resetModules(); // Clear module cache for re-import
    process.env.CSRF_SECRET = 'short';
    expect(() => require('@/lib/security/csrf')).toThrow('CSRF_SECRET environment variable is required and must be at least 32 characters.');
  });

  it('should generate a CSRF token of the correct length', () => {
    const token = generateCSRFToken();
    expect(token).toHaveLength(64); // 32 bytes * 2 hex chars/byte
  });

  it('should create a signed token', () => {
    const token = generateCSRFToken();
    const signedToken = createSignedToken(token);
    expect(signedToken.split('.')).toHaveLength(3);
    expect(signedToken).toContain(token);
  });

  describe('verifySignedToken', () => {
    it('should return true for a valid signed token', () => {
      const token = generateCSRFToken();
      const signedToken = createSignedToken(token);
      expect(verifySignedToken(signedToken)).toBe(true);
    });

    it('should return false for an invalid signed token (bad signature)', () => {
      const token = generateCSRFToken();
      const signedToken = createSignedToken(token);
      const tamperedToken = signedToken.slice(0, -1) + 'X'; // Tamper with signature
      expect(verifySignedToken(tamperedToken)).toBe(false);
    });

    it('should return false for an expired signed token', () => {
      const token = generateCSRFToken();
      // Manually create an expired token
      const expiredTimestamp = Date.now() - 90000; // 90 seconds ago, maxAge is 86400000 (24 hours)
      const data = `${token}.${expiredTimestamp}`;
      const signature = crypto.createHmac('sha256', process.env.CSRF_SECRET!).update(data).digest('hex');
      const expiredSignedToken = `${data}.${signature}`;

      expect(verifySignedToken(expiredSignedToken, 1000)).toBe(false); // Max age 1 second
    });

    it('should return false for a malformed signed token', () => {
      expect(verifySignedToken('token.timestamp')).toBe(false);
      expect(verifySignedToken('token.timestamp.signature.extra')).toBe(false);
      expect(verifySignedToken('malformed')).toBe(false);
    });
  });

  describe('requiresCSRFProtection', () => {
    it('should return true for POST, PUT, DELETE, PATCH methods', () => {
      expect(requiresCSRFProtection('POST')).toBe(true);
      expect(requiresCSRFProtection('PUT')).toBe(true);
      expect(requiresCSRFProtection('DELETE')).toBe(true);
      expect(requiresCSRFProtection('PATCH')).toBe(true);
    });

    it('should return false for GET, HEAD, OPTIONS methods', () => {
      expect(requiresCSRFProtection('GET')).toBe(false);
      expect(requiresCSRFProtection('HEAD')).toBe(false);
      expect(requiresCSRFProtection('OPTIONS')).toBe(false);
    });
  });

  describe('shouldSkipCSRF', () => {
    it('should return true for webhook paths', () => {
      expect(shouldSkipCSRF('/api/stripe/webhooks')).toBe(true);
      expect(shouldSkipCSRF('/api/stripe/connect/webhooks')).toBe(true);
    });

    it('should return true for health check paths', () => {
      expect(shouldSkipCSRF('/api/health')).toBe(true);
    });

    it('should return false for other paths', () => {
      expect(shouldSkipCSRF('/dashboard')).toBe(false);
      expect(shouldSkipCSRF('/api/bookings')).toBe(false);
    });
  });

  it('csrfCookieOptions should have correct properties', () => {
    expect(csrfCookieOptions.name).toBe('__Host-csrf-token');
    expect(csrfCookieOptions.httpOnly).toBe(true);
    expect(csrfCookieOptions.sameSite).toBe('strict');
    expect(csrfCookieOptions.path).toBe('/');
    expect(csrfCookieOptions.maxAge).toBe(86400);
    // Secure property depends on NODE_ENV
    const isProd = process.env.NODE_ENV === 'production';
    expect(csrfCookieOptions.secure).toBe(isProd);
  });
});
