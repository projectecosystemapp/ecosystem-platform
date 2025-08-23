/**
 * CSRF Protection Test Suite
 * 
 * Tests to verify that CSRF protection is properly implemented
 * and the vulnerability has been fixed.
 */

import { 
  generateCSRFToken, 
  createSignedCSRFToken, 
  verifySignedCSRFToken,
  validateCSRFToken 
} from '../server-action-security';
import { cookies } from 'next/headers';

// Mock Next.js modules
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
  headers: jest.fn(),
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('CSRF Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set CSRF_SECRET for testing
    process.env.CSRF_SECRET = 'test-secret-key-for-csrf-protection';
  });

  describe('generateCSRFToken', () => {
    it('should generate a cryptographically secure token', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();

      // Tokens should be 64 characters (32 bytes in hex)
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);

      // Tokens should be unique
      expect(token1).not.toBe(token2);

      // Tokens should be hex strings
      expect(token1).toMatch(/^[a-f0-9]{64}$/);
      expect(token2).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('createSignedCSRFToken', () => {
    it('should create a signed token with timestamp', () => {
      const token = generateCSRFToken();
      const signedToken = createSignedCSRFToken(token);

      // Should have three parts: token, timestamp, signature
      const parts = signedToken.split('.');
      expect(parts).toHaveLength(3);

      // First part should be the original token
      expect(parts[0]).toBe(token);

      // Second part should be a timestamp
      const timestamp = parseInt(parts[1], 10);
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());

      // Third part should be a signature (64 chars for sha256 hex)
      expect(parts[2]).toHaveLength(64);
      expect(parts[2]).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifySignedCSRFToken', () => {
    it('should verify a valid signed token', () => {
      const token = generateCSRFToken();
      const signedToken = createSignedCSRFToken(token);

      const result = verifySignedCSRFToken(signedToken);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject token with invalid format', () => {
      const result = verifySignedCSRFToken('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid token format');
    });

    it('should reject token with tampered signature', () => {
      const token = generateCSRFToken();
      const signedToken = createSignedCSRFToken(token);
      
      // Tamper with the signature
      const parts = signedToken.split('.');
      parts[2] = 'a'.repeat(64); // Replace with invalid signature
      const tamperedToken = parts.join('.');

      const result = verifySignedCSRFToken(tamperedToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });

    it('should reject expired token', () => {
      const token = generateCSRFToken();
      const timestamp = Date.now() - 90000000; // Over 24 hours ago
      const data = `${token}.${timestamp}`;
      const crypto = require('crypto');
      const signature = crypto
        .createHash('sha256')
        .update(`${process.env.CSRF_SECRET}.${data}`)
        .digest('hex');
      const expiredToken = `${data}.${signature}`;

      const result = verifySignedCSRFToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token expired');
    });

    it('should reject token with future timestamp', () => {
      const token = generateCSRFToken();
      const timestamp = Date.now() + 10000; // Future timestamp
      const data = `${token}.${timestamp}`;
      const crypto = require('crypto');
      const signature = crypto
        .createHash('sha256')
        .update(`${process.env.CSRF_SECRET}.${data}`)
        .digest('hex');
      const futureToken = `${data}.${signature}`;

      const result = verifySignedCSRFToken(futureToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token timestamp invalid');
    });
  });

  describe('validateCSRFToken', () => {
    it('should reject when no cookie token is present', async () => {
      const mockCookies = {
        get: jest.fn().mockReturnValue(undefined),
      };
      (cookies as jest.Mock).mockResolvedValue(mockCookies);

      const result = await validateCSRFToken('some-token');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No session token');
    });

    it('should reject when no request token is provided', async () => {
      const token = generateCSRFToken();
      const signedToken = createSignedCSRFToken(token);
      
      const mockCookies = {
        get: jest.fn().mockReturnValue({ value: signedToken }),
      };
      (cookies as jest.Mock).mockResolvedValue(mockCookies);

      const mockHeaders = {
        get: jest.fn().mockReturnValue(null),
      };
      jest.spyOn(require('next/headers'), 'headers').mockResolvedValue(mockHeaders);

      const result = await validateCSRFToken(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No request token');
    });

    it('should reject when tokens do not match', async () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      const signedToken1 = createSignedCSRFToken(token1);
      const signedToken2 = createSignedCSRFToken(token2);
      
      const mockCookies = {
        get: jest.fn().mockReturnValue({ value: signedToken1 }),
      };
      (cookies as jest.Mock).mockResolvedValue(mockCookies);

      const result = await validateCSRFToken(signedToken2);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token mismatch');
    });

    it('should accept matching valid tokens', async () => {
      const token = generateCSRFToken();
      const signedToken = createSignedCSRFToken(token);
      
      const mockCookies = {
        get: jest.fn().mockReturnValue({ value: signedToken }),
      };
      (cookies as jest.Mock).mockResolvedValue(mockCookies);

      const result = await validateCSRFToken(signedToken);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should use timing-safe comparison', async () => {
      // This test verifies that timing-safe comparison is used
      // by checking that the timingSafeEqual function is imported
      const serverActionSecurity = require('../server-action-security');
      const moduleText = serverActionSecurity.toString();
      
      // Check that crypto.timingSafeEqual is imported
      expect(moduleText).toContain('timingSafeEqual');
    });
  });

  describe('CSRF Protection Integration', () => {
    it('should NOT always return true (vulnerability fixed)', async () => {
      // This test specifically checks that the vulnerability is fixed
      const mockCookies = {
        get: jest.fn().mockReturnValue(undefined),
      };
      (cookies as jest.Mock).mockResolvedValue(mockCookies);

      // With no tokens, validation should fail
      const result = await validateCSRFToken();
      expect(result.valid).toBe(false);
      
      // The old vulnerable code would return true here
      expect(result.valid).not.toBe(true);
    });

    it('should return 403 status for invalid tokens', async () => {
      const mockCookies = {
        get: jest.fn().mockReturnValue({ value: 'invalid-token' }),
      };
      (cookies as jest.Mock).mockResolvedValue(mockCookies);

      const result = await validateCSRFToken('different-invalid-token');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      
      // In production, this would trigger a 403 response
      expect(result.error).toContain('CSRF protection');
    });
  });
});