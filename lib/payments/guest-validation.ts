/**
 * Guest Checkout Validation and Sanitization Utilities
 * 
 * Security-focused utilities for processing guest checkout data
 * with proper validation, sanitization, and rate limiting support
 */

import { z } from 'zod';
import * as crypto from 'crypto';

// Email validation and sanitization
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'mailinator.com',
  'throwaway.email',
  // Add more as needed
];

/**
 * Validate and sanitize email address
 */
export function validateGuestEmail(email: string): {
  valid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];
  let sanitized = email.toLowerCase().trim();
  
  // Remove any potential XSS attempts
  sanitized = sanitized.replace(/[<>\"']/g, '');
  
  // Check format
  if (!EMAIL_REGEX.test(sanitized)) {
    errors.push('Invalid email format');
  }
  
  // Check length
  if (sanitized.length > 254) {
    errors.push('Email address too long');
  }
  
  // Check for disposable email domains (optional)
  const domain = sanitized.split('@')[1];
  if (domain && DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    errors.push('Disposable email addresses are not allowed');
  }
  
  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Validate guest name
 */
export function validateGuestName(name: string): {
  valid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];
  let sanitized = name.trim();
  
  // Remove potential XSS/SQL injection attempts
  sanitized = sanitized.replace(/[<>\"';]/g, '');
  
  // Check length
  if (sanitized.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (sanitized.length > 100) {
    errors.push('Name must be less than 100 characters');
  }
  
  // Check for suspicious patterns
  if (/\d{4,}/.test(sanitized)) {
    errors.push('Name contains suspicious patterns');
  }
  
  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Validate phone number (optional field)
 */
export function validateGuestPhone(phone?: string): {
  valid: boolean;
  sanitized?: string;
  errors: string[];
} {
  if (!phone) {
    return { valid: true, errors: [] };
  }
  
  const errors: string[] = [];
  // Remove all non-digit characters for validation
  let sanitized = phone.replace(/\D/g, '');
  
  // Check length (10-15 digits for international)
  if (sanitized.length < 10 || sanitized.length > 15) {
    errors.push('Invalid phone number length');
  }
  
  // Format for display (US format example)
  if (sanitized.length === 10) {
    sanitized = `(${sanitized.slice(0, 3)}) ${sanitized.slice(3, 6)}-${sanitized.slice(6)}`;
  }
  
  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Create a secure guest session token
 */
export function createGuestSessionToken(
  email: string,
  bookingId: string,
  expiresInMinutes: number = 30
): string {
  const payload = {
    email: email.toLowerCase(),
    bookingId,
    exp: Date.now() + (expiresInMinutes * 60 * 1000),
    iat: Date.now()
  };
  
  const secret = process.env.GUEST_SESSION_SECRET || 'default-secret-change-in-production';
  const token = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  // Combine payload and signature
  return Buffer.from(JSON.stringify(payload)).toString('base64') + '.' + token;
}

/**
 * Verify guest session token
 */
export function verifyGuestSessionToken(token: string): {
  valid: boolean;
  payload?: {
    email: string;
    bookingId: string;
    exp: number;
    iat: number;
  };
  error?: string;
} {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }
    
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    
    // Check expiration
    if (payload.exp < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Verify signature
    const secret = process.env.GUEST_SESSION_SECRET || 'default-secret-change-in-production';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Rate limiting key for guest checkouts
 */
export function getGuestRateLimitKey(
  email: string,
  ipAddress: string
): string {
  // Combine email and IP for rate limiting
  const combined = `${email.toLowerCase()}-${ipAddress}`;
  return crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Check if booking time is valid
 */
export function validateBookingTime(
  bookingDate: string,
  startTime: string,
  endTime: string
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    const date = new Date(bookingDate);
    const now = new Date();
    
    // Check if date is in the past
    if (date < now) {
      errors.push('Booking date cannot be in the past');
    }
    
    // Check if date is too far in the future (e.g., 6 months)
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    if (date > sixMonthsFromNow) {
      errors.push('Booking date cannot be more than 6 months in the future');
    }
    
    // Validate time format and logic
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      errors.push('Invalid time format');
    }
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      errors.push('End time must be after start time');
    }
    
    // Check for reasonable booking duration (e.g., max 8 hours)
    if (endMinutes - startMinutes > 480) {
      errors.push('Booking duration cannot exceed 8 hours');
    }
    
  } catch (error) {
    errors.push('Invalid date format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Guest checkout request schema for validation
 */
export const guestCheckoutSchema = z.object({
  // Guest information
  guestEmail: z.string()
    .email('Invalid email address')
    .max(254, 'Email too long')
    .transform(email => email.toLowerCase().trim()),
  
  guestName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .transform(name => name.trim()),
  
  guestPhone: z.string()
    .optional()
    .transform(phone => phone?.replace(/\D/g, '')),
  
  // Service details
  providerId: z.string().uuid('Invalid provider ID'),
  serviceId: z.string().uuid('Invalid service ID'),
  
  // Booking details
  bookingDate: z.string().datetime('Invalid date format'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  
  // Optional fields
  customerNotes: z.string().max(500, 'Notes too long').optional(),
  
  // Tracking
  referrer: z.string().max(100).optional(),
  utmSource: z.string().max(50).optional(),
  utmMedium: z.string().max(50).optional(),
  utmCampaign: z.string().max(50).optional(),
});

export type GuestCheckoutRequest = z.infer<typeof guestCheckoutSchema>;

/**
 * Sanitize all guest input at once
 */
export function sanitizeGuestCheckoutData(
  data: GuestCheckoutRequest
): {
  valid: boolean;
  sanitized?: GuestCheckoutRequest;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validate email
  const emailValidation = validateGuestEmail(data.guestEmail);
  if (!emailValidation.valid) {
    errors.push(...emailValidation.errors);
  }
  
  // Validate name
  const nameValidation = validateGuestName(data.guestName);
  if (!nameValidation.valid) {
    errors.push(...nameValidation.errors);
  }
  
  // Validate phone if provided
  if (data.guestPhone) {
    const phoneValidation = validateGuestPhone(data.guestPhone);
    if (!phoneValidation.valid) {
      errors.push(...phoneValidation.errors);
    }
  }
  
  // Validate booking time
  const timeValidation = validateBookingTime(
    data.bookingDate,
    data.startTime,
    data.endTime
  );
  if (!timeValidation.valid) {
    errors.push(...timeValidation.errors);
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    sanitized: {
      ...data,
      guestEmail: emailValidation.sanitized,
      guestName: nameValidation.sanitized,
      customerNotes: data.customerNotes?.trim().substring(0, 500),
    },
    errors: []
  };
}

/**
 * Generate a secure booking reference for guests
 */
export function generateGuestBookingReference(
  bookingId: string,
  email: string
): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${bookingId}-${email.toLowerCase()}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
  
  // Format: BOOK-XXXX-XXXX
  return `BOOK-${hash.substring(0, 4)}-${hash.substring(4, 8)}`;
}

/**
 * Mask email for display (for privacy)
 */
export function maskGuestEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***@***.***';
  
  const maskedLocal = localPart.length > 2 
    ? localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1]
    : '*'.repeat(localPart.length);
  
  return `${maskedLocal}@${domain}`;
}