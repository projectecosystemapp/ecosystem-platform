import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import middleware from '@/middleware'; // Import the actual middleware
import { generateCSRFToken, createSignedToken, verifySignedToken, csrfCookieOptions } from '@/lib/security/csrf';

// Mock Clerk's auth() and clerkMiddleware
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() => ({
    userId: 'user_test_123',
    sessionClaims: { metadata: { role: 'user' } },
    protect: jest.fn(),
  })),
  clerkMiddleware: jest.fn((handler) => handler),
}));

// Mock the actual middleware's dependencies if needed, but for CSRF, it mostly relies on NextRequest/Response

describe('Middleware CSRF Protection', () => {
  const originalEnv = process.env;
  let csrfSecret: string;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set a consistent CSRF_SECRET for testing
    csrfSecret = 'middleware_csrf_secret_12345678901234567890';
    process.env = { ...originalEnv, CSRF_SECRET: csrfSecret, NODE_ENV: 'development' };
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original env
  });

  it('should generate a CSRF token for GET requests if none exists', async () => {
    const req = new NextRequest('http://localhost/dashboard', { method: 'GET' });
    const res = NextResponse.next();

    const response = await middleware(jest.fn() as any, req);

    expect(response.status).toBe(200);
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain(csrfCookieOptions.name);

    const cookieValue = setCookieHeader?.split(';')[0].split('=')[1];
    expect(verifySignedToken(cookieValue!)).toBe(true);
  });

  it('should not generate a new CSRF token for GET requests if one already exists', async () => {
    const existingToken = createSignedToken(generateCSRFToken());
    const req = new NextRequest('http://localhost/dashboard', {
      method: 'GET',
      headers: { 'Cookie': `${csrfCookieOptions.name}=${existingToken}` },
    });
    const res = NextResponse.next();

    const response = await middleware(jest.fn() as any, req);

    expect(response.status).toBe(200);
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toBeNull(); // No new cookie should be set
  });

  it('should allow POST requests with a valid CSRF token', async () => {
    const token = generateCSRFToken();
    const signedToken = createSignedToken(token);

    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        'Cookie': `${csrfCookieOptions.name}=${signedToken}`,
        'x-csrf-token': signedToken,
      },
    });
    const res = NextResponse.next();

    const response = await middleware(jest.fn() as any, req);

    expect(response.status).toBe(200);
  });

  it('should block POST requests if CSRF cookie is missing', async () => {
    const req = new NextRequest('http://localhost/api/bookings', { method: 'POST' });
    const res = NextResponse.next();

    const response = await middleware(jest.fn() as any, req);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('CSRF token missing');
  });

  it('should block POST requests if CSRF header is missing', async () => {
    const token = generateCSRFToken();
    const signedToken = createSignedToken(token);

    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Cookie': `${csrfCookieOptions.name}=${signedToken}` },
    });
    const res = NextResponse.next();

    const response = await middleware(jest.fn() as any, req);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('CSRF token header missing');
  });

  it('should block POST requests if CSRF token is invalid', async () => {
    const validToken = generateCSRFToken();
    const validSignedToken = createSignedToken(validToken);
    const invalidSignedToken = validSignedToken.slice(0, -5) + 'INVALID'; // Tamper

    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        'Cookie': `${csrfCookieOptions.name}=${validSignedToken}`,
        'x-csrf-token': invalidSignedToken,
      },
    });
    const res = NextResponse.next();

    const response = await middleware(jest.fn() as any, req);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Invalid CSRF token');
  });

  it('should skip CSRF protection for specified paths (e.g., webhooks)', async () => {
    const req = new NextRequest('http://localhost/api/stripe/webhooks', { method: 'POST' });
    const res = NextResponse.next();

    const response = await middleware(jest.fn() as any, req);

    expect(response.status).toBe(200); // Should not be 403
    expect(await response.text()).not.toBe('CSRF token missing');
  });

  it('should not apply CSRF protection for safe methods (HEAD, OPTIONS)', async () => {
    const reqHead = new NextRequest('http://localhost/api/bookings', { method: 'HEAD' });
    const resHead = NextResponse.next();
    const responseHead = await middleware(jest.fn() as any, reqHead);
    expect(responseHead.status).toBe(200);

    const reqOptions = new NextRequest('http://localhost/api/bookings', { method: 'OPTIONS' });
    const resOptions = NextResponse.next();
    const responseOptions = await middleware(jest.fn() as any, reqOptions);
    expect(responseOptions.status).toBe(200);
  });
});
