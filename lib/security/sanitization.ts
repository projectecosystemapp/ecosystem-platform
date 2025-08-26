/**
 * Security Sanitization Utilities
 * 
 * Provides comprehensive input sanitization and validation
 * to prevent XSS, SQL injection, and other security vulnerabilities
 */

import DOMPurify from 'isomorphic-dompurify';
import he from 'he';

/**
 * HTML Entity encoding to prevent XSS attacks
 * Converts special characters to HTML entities
 */
export function encodeHtmlEntities(str: string): string {
  if (!str) return '';
  return he.encode(str, {
    useNamedReferences: true,
    decimal: false,
    encodeEverything: false
  });
}

/**
 * Decode HTML entities safely
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return he.decode(str);
}

/**
 * Sanitize HTML content to prevent XSS
 * Allows safe HTML tags while removing dangerous ones
 */
export function sanitizeHtml(html: string, options?: any): string {
  if (!html) return '';
  
  const defaultConfig = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    RETURN_TRUSTED_TYPE: false
  };
  
  return DOMPurify.sanitize(html, { ...defaultConfig, ...options }) as string;
}

/**
 * Strict sanitization for user inputs that should not contain HTML
 * Removes all HTML tags and encodes entities
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Remove all HTML tags
  const stripped = DOMPurify.sanitize(text, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true 
  });
  
  // Encode any remaining HTML entities
  return encodeHtmlEntities(stripped);
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  
  // Basic email validation and sanitization
  const trimmed = email.toLowerCase().trim();
  
  // Remove any HTML tags or scripts
  const sanitized = sanitizeText(trimmed);
  
  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Sanitize phone numbers
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  
  // Remove all non-numeric characters except + for international codes
  return phone.replace(/[^\d+]/g, '').slice(0, 20);
}

/**
 * Sanitize names (first name, last name, etc.)
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  // Remove HTML and limit length
  const sanitized = sanitizeText(name).slice(0, 100);
  
  // Allow only letters, spaces, hyphens, and apostrophes
  return sanitized.replace(/[^a-zA-Z\s'-]/g, '');
}

/**
 * Sanitize URLs to prevent javascript: and data: protocols
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = trimmed.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }
  
  // Ensure URL starts with http://, https://, or /
  if (!trimmed.match(/^(https?:\/\/|\/)/i)) {
    return '';
  }
  
  return encodeHtmlEntities(trimmed);
}

/**
 * Sanitize file names for uploads
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') return '';
  
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '');
  
  // Remove special characters except dots and hyphens
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
  
  // Limit length
  return sanitized.slice(0, 255);
}

/**
 * Sanitize JSON data to prevent injection attacks
 */
export function sanitizeJson(data: any): any {
  if (typeof data === 'string') {
    return sanitizeText(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeJson(item));
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        // Sanitize the key as well
        const sanitizedKey = sanitizeText(key);
        sanitized[sanitizedKey] = sanitizeJson(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Sanitize SQL identifiers (table names, column names)
 * Note: This should be used in addition to parameterized queries
 */
export function sanitizeSqlIdentifier(identifier: string): string {
  if (!identifier || typeof identifier !== 'string') return '';
  
  // Allow only alphanumeric characters and underscores
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Sanitize integers
 */
export function sanitizeInt(value: any, defaultValue: number = 0): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Sanitize floats/decimals
 */
export function sanitizeFloat(value: any, defaultValue: number = 0): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Sanitize boolean values
 */
export function sanitizeBoolean(value: any): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

/**
 * Comprehensive sanitization for guest checkout data
 */
export interface GuestInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export function sanitizeGuestInfo(data: any): GuestInfo | null {
  if (!data || typeof data !== 'object') return null;
  
  const email = sanitizeEmail(data.email || '');
  const firstName = sanitizeName(data.firstName || '');
  const lastName = sanitizeName(data.lastName || '');
  const phone = sanitizePhone(data.phone || '');
  
  // Validate required fields
  if (!email || !firstName || !lastName || !phone) {
    return null;
  }
  
  return {
    email,
    firstName,
    lastName,
    phone
  };
}

/**
 * Sanitize search queries to prevent injection
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') return '';
  
  // Remove SQL wildcards and special characters
  let sanitized = query.replace(/[%_]/g, '');
  
  // Remove potential SQL injection attempts
  sanitized = sanitized.replace(/['";\\]/g, '');
  
  // Limit length
  return sanitized.trim().slice(0, 100);
}

/**
 * Rate limit key sanitization
 */
export function sanitizeRateLimitKey(key: string): string {
  if (!key || typeof key !== 'string') return 'unknown';
  
  // Remove special characters that might break Redis keys
  return key.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 128);
}

/**
 * Validate and sanitize UUID
 */
export function sanitizeUuid(uuid: string): string {
  if (!uuid || typeof uuid !== 'string') return '';
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  const trimmed = uuid.trim().toLowerCase();
  return uuidRegex.test(trimmed) ? trimmed : '';
}

/**
 * Sanitize and validate ISO date strings
 */
export function sanitizeIsoDate(date: string): string {
  if (!date || typeof date !== 'string') return '';
  
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return '';
    return parsed.toISOString();
  } catch {
    return '';
  }
}

/**
 * Content Security Policy nonce validation
 */
export function isValidNonce(nonce: string): boolean {
  if (!nonce || typeof nonce !== 'string') return false;
  
  // Nonces should be base64 encoded and at least 16 characters
  const nonceRegex = /^[A-Za-z0-9+/=]{16,}$/;
  return nonceRegex.test(nonce);
}

/**
 * Export all sanitization functions as a namespace
 */
export const Sanitize = {
  html: sanitizeHtml,
  text: sanitizeText,
  email: sanitizeEmail,
  phone: sanitizePhone,
  name: sanitizeName,
  url: sanitizeUrl,
  fileName: sanitizeFileName,
  json: sanitizeJson,
  sqlIdentifier: sanitizeSqlIdentifier,
  int: sanitizeInt,
  float: sanitizeFloat,
  boolean: sanitizeBoolean,
  guestInfo: sanitizeGuestInfo,
  searchQuery: sanitizeSearchQuery,
  rateLimitKey: sanitizeRateLimitKey,
  uuid: sanitizeUuid,
  isoDate: sanitizeIsoDate,
  encodeHtml: encodeHtmlEntities,
  decodeHtml: decodeHtmlEntities
};

export default Sanitize;