/**
 * Secure Guest Identifier Service
 * Uses bcrypt for one-way hashing of guest emails
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12; // Increased from default 10 for better security

/**
 * Create a secure, one-way hash of guest email
 * Uses bcrypt to prevent rainbow table attacks
 */
export async function createSecureGuestIdentifier(email: string): Promise<string> {
  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();
  
  // Add application-specific pepper (stored in env)
  const pepper = process.env.GUEST_EMAIL_PEPPER;
  if (!pepper) {
    throw new Error('GUEST_EMAIL_PEPPER environment variable is required');
  }
  
  // Combine email with pepper
  const pepperedEmail = `${normalizedEmail}:${pepper}`;
  
  // Generate secure hash
  const hash = await bcrypt.hash(pepperedEmail, SALT_ROUNDS);
  
  // Return URL-safe version
  return Buffer.from(hash).toString('base64url').substring(0, 32);
}

/**
 * Verify a guest email against stored identifier
 */
export async function verifyGuestIdentifier(
  email: string, 
  storedIdentifier: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const pepper = process.env.GUEST_EMAIL_PEPPER;
  
  if (!pepper) {
    throw new Error('GUEST_EMAIL_PEPPER environment variable is required');
  }
  
  const pepperedEmail = `${normalizedEmail}:${pepper}`;
  
  // Decode the stored identifier
  const hash = Buffer.from(storedIdentifier, 'base64url').toString();
  
  // Verify using bcrypt
  return bcrypt.compare(pepperedEmail, hash);
}

/**
 * Generate a secure confirmation code for bookings
 */
export function generateSecureConfirmationCode(): string {
  // Generate 8 character alphanumeric code
  const bytes = crypto.randomBytes(6);
  return bytes.toString('base64url').substring(0, 8).toUpperCase();
}
