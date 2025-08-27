// @ts-nocheck
/**
 * CSRF Token Refresh Endpoint
 * 
 * Provides a way for clients to obtain or refresh their CSRF token
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, createSignedCSRFToken } from '@/lib/server-action-security';

export async function GET(request: NextRequest) {
  try {
    // Generate new CSRF token
    const token = generateCSRFToken();
    const signedToken = createSignedCSRFToken(token);
    
    // Create response
    const response = NextResponse.json(
      { 
        success: true,
        message: 'CSRF token refreshed'
      },
      { status: 200 }
    );
    
    // Set the token in an HTTP-only cookie
    response.cookies.set({
      name: process.env.NODE_ENV === 'production' ? '__Host-csrf-token' : 'csrf-token',
      value: signedToken,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 86400, // 24 hours
    });
    
    // Also include in response header for client-side storage
    response.headers.set('X-CSRF-Token', signedToken);
    
    return response;
  } catch (error) {
    console.error('[Security] CSRF token refresh error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to refresh token' 
      },
      { status: 500 }
    );
  }
}

// Only allow GET requests for token refresh
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}