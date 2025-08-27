/**
 * Google OAuth Configuration
 * 
 * Provides Google Sign-In integration for the marketplace
 * Can be used alongside Clerk for multiple auth options
 */

export const googleOAuthConfig = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  
  // OAuth URLs
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  
  // Scopes for user information
  scopes: [
    'openid',
    'email',
    'profile',
  ],
  
  // Redirect URIs (update these for production)
  redirectUris: {
    development: 'http://localhost:3000/api/auth/google/callback',
    production: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
  },
};

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: googleOAuthConfig.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: googleOAuthConfig.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  
  return `${googleOAuthConfig.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}> {
  const response = await fetch(googleOAuthConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: googleOAuthConfig.clientId,
      client_secret: googleOAuthConfig.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }
  
  return response.json();
}

/**
 * Get user information from Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}> {
  const response = await fetch(googleOAuthConfig.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to get user information from Google');
  }
  
  return response.json();
}

/**
 * Verify Google ID token (for client-side authentication)
 */
export async function verifyGoogleIdToken(idToken: string): Promise<any> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );
  
  if (!response.ok) {
    throw new Error('Invalid ID token');
  }
  
  const payload = await response.json();
  
  // Verify the token is for our app
  if (payload.aud !== googleOAuthConfig.clientId) {
    throw new Error('Token was not issued for this application');
  }
  
  return payload;
}

/**
 * Check if Google OAuth is properly configured
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  );
}