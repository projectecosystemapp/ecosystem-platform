/**
 * Security Validation Utilities
 * 
 * Input validation and sanitization for security
 */

import { z } from 'zod';
import { securityValidators, securityPolicies } from './config';

/**
 * Common security schemas for validation
 */
export const securitySchemas = {
  /**
   * Email validation schema
   */
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .refine(
      (email) => !securityValidators.hasXSSPattern(email),
      'Invalid characters in email'
    ),
  
  /**
   * URL validation schema
   */
  url: z
    .string()
    .url('Invalid URL')
    .max(2048, 'URL too long')
    .refine(
      (url) => {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      },
      'Only HTTP(S) URLs are allowed'
    ),
  
  /**
   * Safe text input schema
   */
  safeText: z
    .string()
    .max(securityPolicies.content.maxInputLength)
    .refine(
      (text) => !securityValidators.hasSQLInjectionPattern(text),
      'Invalid characters detected'
    )
    .refine(
      (text) => !securityValidators.hasXSSPattern(text),
      'Invalid HTML content detected'
    )
    .transform((text) => securityValidators.sanitizeInput(text)),
  
  /**
   * Safe HTML content schema (for rich text editors)
   */
  safeHtml: z
    .string()
    .max(securityPolicies.content.maxTextAreaLength)
    .transform((html) => sanitizeHtml(html)),
  
  /**
   * Phone number schema
   */
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .max(20),
  
  /**
   * UUID schema
   */
  uuid: z
    .string()
    .uuid('Invalid ID format'),
  
  /**
   * Safe filename schema
   */
  filename: z
    .string()
    .max(255)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9_\-. ]*[a-zA-Z0-9]$/,
      'Invalid filename'
    )
    .refine(
      (name) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return !ext || !['exe', 'bat', 'cmd', 'sh', 'ps1'].includes(ext);
      },
      'File type not allowed'
    ),
  
  /**
   * Pagination schema
   */
  pagination: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['asc', 'desc']).optional(),
    sortBy: z.string().max(50).optional(),
  }),
  
  /**
   * Date range schema
   */
  dateRange: z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  }).refine(
    (data) => data.to >= data.from,
    'End date must be after start date'
  ),
};

/**
 * Sanitize HTML content (remove dangerous elements)
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove iframe tags
  html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove object and embed tags
  html = html.replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, '');
  
  // Remove event handlers
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  html = html.replace(/javascript:/gi, '');
  
  // Remove data: protocol for non-image sources
  html = html.replace(/(<(?!img)[^>]+)\s+src\s*=\s*["']data:[^"']*["']/gi, '$1');
  
  return html;
}

/**
 * Create a secure form validation schema
 */
export function createSecureFormSchema<T extends z.ZodRawShape>(
  shape: T,
  options?: {
    maxFields?: number;
    allowHtml?: boolean;
  }
): z.ZodObject<T> | z.ZodEffects<z.ZodObject<T>> {
  const schema = z.object(shape);
  
  // Add additional validation
  return schema.refine(
    (data) => {
      // Check maximum number of fields
      if (options?.maxFields && Object.keys(data).length > options.maxFields) {
        return false;
      }
      
      // Check for suspicious patterns in values
      for (const value of Object.values(data)) {
        if (typeof value === 'string') {
          if (!options?.allowHtml && securityValidators.hasXSSPattern(value)) {
            return false;
          }
          if (securityValidators.hasSQLInjectionPattern(value)) {
            return false;
          }
        }
      }
      
      return true;
    },
    {
      message: 'Form contains invalid data',
    }
  );
}

/**
 * Validate and sanitize API request
 */
export async function validateApiRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { success: false, error: 'Invalid content type' };
    }
    
    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > securityPolicies.api.maxRequestSize) {
      return { success: false, error: 'Request too large' };
    }
    
    // Parse and validate body
    const body = await request.json();
    const validated = schema.parse(body);
    
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || 'Validation failed' };
    }
    return { success: false, error: 'Invalid request' };
  }
}

/**
 * Validate file upload
 */
export function validateFileUpload(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file size
  if (file.size > securityPolicies.fileUpload.maxSize) {
    return { valid: false, error: 'File too large' };
  }
  
  // Check MIME type
  if (!securityPolicies.fileUpload.allowedMimeTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  // Check extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!securityPolicies.fileUpload.allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' };
  }
  
  // Check filename
  try {
    securitySchemas.filename.parse(file.name);
  } catch {
    return { valid: false, error: 'Invalid filename' };
  }
  
  return { valid: true };
}

/**
 * Rate limit key generator
 */
export function generateRateLimitKey(
  identifier: string,
  action: string,
  window?: string
): string {
  const sanitizedId = identifier.replace(/[^a-zA-Z0-9-_]/g, '');
  const sanitizedAction = action.replace(/[^a-zA-Z0-9-_]/g, '');
  return `ratelimit:${sanitizedId}:${sanitizedAction}${window ? `:${window}` : ''}`;
}

/**
 * Check if IP is from a known bot or crawler
 */
export function isKnownBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  
  const botPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /slackbot/i,
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Generate secure random string
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => chars[byte % chars.length]).join('');
}