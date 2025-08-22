import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * CSRF Token Utilities
 * Provides secure CSRF token generation and validation for booking forms
 */

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32; // bytes
const CSRF_TOKEN_LIFETIME = 3600; // 1 hour in seconds
const CSRF_SECRET = process.env.CSRF_SECRET || "default-csrf-secret-change-in-production";

interface CsrfTokenData {
  token: string;
  userId: string;
  timestamp: number;
}

/**
 * Generate a CSRF token for the given user
 * @param userId - The authenticated user ID
 * @returns Promise<string> - Base64 encoded CSRF token
 */
export async function generateCsrfToken(userId: string): Promise<string> {
  try {
    // Generate random token
    const randomToken = randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
    
    // Create timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Create token data
    const tokenData: CsrfTokenData = {
      token: randomToken,
      userId,
      timestamp,
    };
    
    // Create HMAC signature
    const payload = JSON.stringify(tokenData);
    const signature = createHash("sha256")
      .update(CSRF_SECRET + payload)
      .digest("hex");
    
    // Combine payload and signature
    const finalToken = Buffer.from(payload + "." + signature).toString("base64");
    
    return finalToken;
    
  } catch (error) {
    console.error("Error generating CSRF token:", error);
    throw new Error("Failed to generate CSRF token");
  }
}

/**
 * Verify a CSRF token against the given user
 * @param token - Base64 encoded CSRF token to verify
 * @param userId - The authenticated user ID
 * @returns Promise<boolean> - True if token is valid
 */
export async function verifyCsrfToken(token: string, userId: string): Promise<boolean> {
  try {
    if (!token || !userId) {
      return false;
    }
    
    // Decode token
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [payload, signature] = decoded.split(".");
    
    if (!payload || !signature) {
      return false;
    }
    
    // Parse token data
    const tokenData: CsrfTokenData = JSON.parse(payload);
    
    // Verify user ID matches
    if (tokenData.userId !== userId) {
      return false;
    }
    
    // Check token age
    const now = Math.floor(Date.now() / 1000);
    if (now - tokenData.timestamp > CSRF_TOKEN_LIFETIME) {
      return false; // Token expired
    }
    
    // Verify signature
    const expectedSignature = createHash("sha256")
      .update(CSRF_SECRET + payload)
      .digest("hex");
    
    // Use timing-safe comparison
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(signatureBuffer, expectedBuffer);
    
  } catch (error) {
    console.error("Error verifying CSRF token:", error);
    return false;
  }
}

/**
 * Get CSRF token for client-side forms
 * This would typically be called from a server action or API route
 * that the client can call to get a fresh token
 */
export async function getCsrfTokenForUser(userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = await generateCsrfToken(userId);
  const expiresAt = Math.floor(Date.now() / 1000) + CSRF_TOKEN_LIFETIME;
  
  return {
    token,
    expiresAt,
  };
}

/**
 * Middleware helper to extract and verify CSRF token from request headers
 * @param request - Next.js request object
 * @param userId - Authenticated user ID
 * @returns Promise<boolean> - True if CSRF token is valid
 */
export async function verifyCsrfFromHeaders(
  request: { headers: { get: (name: string) => string | null } },
  userId: string
): Promise<boolean> {
  const token = request.headers.get("x-csrf-token") || 
                request.headers.get("csrf-token");
  
  if (!token) {
    return false;
  }
  
  return await verifyCsrfToken(token, userId);
}

/**
 * Create a CSRF token action for server components
 * This can be used in forms to get a CSRF token
 */
export async function createCsrfTokenAction(userId: string) {
  "use server";
  
  if (!userId) {
    throw new Error("Authentication required");
  }
  
  return await getCsrfTokenForUser(userId);
}