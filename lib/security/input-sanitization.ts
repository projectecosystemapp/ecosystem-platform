/**
 * Input Sanitization Utilities
 * Prevents XSS, SQL injection, and other injection attacks
 * Per Master PRD Security Requirements
 */

import xss from 'xss';
import { z } from 'zod';

/**
 * XSS Protection Options
 */
const xssOptions = {
  whiteList: {
    a: ['href', 'title', 'target'],
    b: [],
    br: [],
    code: [],
    div: [],
    em: [],
    i: [],
    li: [],
    ol: [],
    p: [],
    pre: [],
    span: [],
    strong: [],
    u: [],
    ul: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return xss(input, xssOptions);
}

/**
 * Sanitize plain text input (removes all HTML)
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove all HTML tags
  const withoutHtml = input.replace(/<[^>]*>/g, '');
  
  // Remove potential SQL injection patterns
  const withoutSqlPatterns = withoutHtml
    .replace(/(\-\-|\/\*|\*\/|;|'|"|`|xp_|sp_|exec|execute|select|insert|update|delete|drop|create|alter|union|from|where)/gi, '');
  
  // Trim whitespace
  return withoutHtml.trim();
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }
  
  // Convert to lowercase and trim
  const normalized = email.toLowerCase().trim();
  
  // Remove any characters that aren't valid in email addresses
  return normalized.replace(/[^a-z0-9@.\-+_]/g, '');
}

/**
 * Sanitize phone numbers
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') {
    return '';
  }
  
  // Remove all non-digit characters except + for international
  return phone.replace(/[^\d+\-\s()]/g, '');
}

/**
 * Sanitize URLs
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') {
    return null;
  }
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Prevent javascript: and data: URLs
    if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
      return null;
    }
    
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize file names
 */
export function sanitizeFileName(fileName: string): string {
  if (typeof fileName !== 'string') {
    return '';
  }
  
  // Remove path traversal attempts
  const withoutPathTraversal = fileName.replace(/\.\./g, '');
  
  // Remove special characters except dots, dashes, and underscores
  const sanitized = withoutPathTraversal.replace(/[^a-zA-Z0-9.\-_]/g, '');
  
  // Ensure it doesn't start with a dot (hidden file)
  return sanitized.replace(/^\./, '');
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: any): number | null {
  const parsed = Number(input);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Sanitize UUID input
 */
export function sanitizeUuid(uuid: string): string | null {
  if (typeof uuid !== 'string') {
    return null;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(uuid)) {
    return null;
  }
  
  return uuid.toLowerCase();
}

/**
 * Sanitize object keys (prevents prototype pollution)
 */
export function sanitizeObjectKeys(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const cleaned: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (dangerous.includes(key)) {
      continue;
    }
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      cleaned[key] = sanitizeObjectKeys(obj[key]);
    } else {
      cleaned[key] = obj[key];
    }
  }
  
  return cleaned;
}

/**
 * Common Zod schemas for validation
 */
export const sanitizationSchemas = {
  email: z.string().email().transform(sanitizeEmail),
  phone: z.string().min(10).max(20).transform(sanitizePhone),
  text: z.string().transform(sanitizeText),
  html: z.string().transform(sanitizeHtml),
  url: z.string().url().transform((url) => sanitizeUrl(url) || ''),
  uuid: z.string().uuid(),
  fileName: z.string().transform(sanitizeFileName),
  
  // Provider-specific
  providerName: z.string()
    .min(2)
    .max(100)
    .transform(sanitizeText),
  
  providerBio: z.string()
    .max(1000)
    .transform(sanitizeHtml),
  
  serviceName: z.string()
    .min(2)
    .max(100)
    .transform(sanitizeText),
  
  serviceDescription: z.string()
    .max(500)
    .transform(sanitizeHtml),
  
  customerNotes: z.string()
    .max(500)
    .optional()
    .transform((notes) => notes ? sanitizeText(notes) : undefined),
  
  reviewText: z.string()
    .min(10)
    .max(1000)
    .transform(sanitizeHtml),
};

/**
 * Create a sanitized server action wrapper
 * Ensures all inputs are validated and sanitized
 */
export function createSanitizedAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (data: TInput) => Promise<TOutput>
) {
  return async (rawInput: unknown): Promise<{ success: boolean; data?: TOutput; error?: string }> => {
    try {
      // Sanitize object keys to prevent prototype pollution
      const sanitizedInput = sanitizeObjectKeys(rawInput);
      
      // Validate and parse with Zod schema
      const result = schema.safeParse(sanitizedInput);
      
      if (!result.success) {
        return {
          success: false,
          error: 'Invalid input: ' + result.error.issues.map(e => e.message).join(', ')
        };
      }
      
      // Execute the handler with sanitized data
      const data = await handler(result.data);
      
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Server action error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      };
    }
  };
}

/**
 * SQL injection prevention for dynamic queries
 * Use this when you absolutely must build dynamic SQL
 */
export function escapeSqlIdentifier(identifier: string): string {
  if (typeof identifier !== 'string') {
    throw new Error('Identifier must be a string');
  }
  
  // Only allow alphanumeric and underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid SQL identifier');
  }
  
  return `"${identifier}"`;
}

/**
 * Validate and sanitize pagination parameters
 */
export function sanitizePagination(params: {
  page?: any;
  limit?: any;
  cursor?: any;
}) {
  return {
    page: Math.max(1, Math.min(1000, sanitizeNumber(params.page) || 1)),
    limit: Math.max(1, Math.min(100, sanitizeNumber(params.limit) || 20)),
    cursor: params.cursor ? sanitizeText(String(params.cursor)) : undefined,
  };
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    return '';
  }
  
  // Remove special characters that could break search
  return query
    .replace(/[<>'"]/g, '')
    .trim()
    .substring(0, 100); // Limit length
}