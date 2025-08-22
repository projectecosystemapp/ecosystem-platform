/**
 * Security Configuration
 * 
 * Centralized security settings and validation
 */

import { z } from 'zod';

/**
 * Security environment variables schema
 */
const securityEnvSchema = z.object({
  // CSRF Configuration
  CSRF_SECRET: z.string().min(32).default('default-csrf-secret-change-in-production'),
  
  // Session Configuration
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_MAX_AGE: z.string().default('86400'), // 24 hours in seconds
  
  // Rate Limiting (Upstash Redis)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Security Flags
  ENABLE_CSRF: z.string().transform(v => v === 'true').default('true'),
  ENABLE_RATE_LIMIT: z.string().transform(v => v === 'true').default('true'),
  ENABLE_SECURITY_HEADERS: z.string().transform(v => v === 'true').default('true'),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

/**
 * Validated security configuration
 */
export const securityConfig = (() => {
  try {
    return securityEnvSchema.parse(process.env);
  } catch (error) {
    console.warn('Security configuration validation failed:', error);
    // Return defaults for development
    return {
      CSRF_SECRET: 'default-csrf-secret-change-in-production',
      SESSION_MAX_AGE: '86400',
      ENABLE_CSRF: true,
      ENABLE_RATE_LIMIT: true,
      ENABLE_SECURITY_HEADERS: true,
      NODE_ENV: 'development' as const,
    };
  }
})();

/**
 * Security policy configuration
 */
export const securityPolicies = {
  // Password requirements
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // days
  },
  
  // Session settings
  session: {
    maxAge: parseInt(securityConfig.SESSION_MAX_AGE, 10),
    renewalThreshold: 0.5, // Renew when 50% of max age reached
    absoluteTimeout: 86400 * 7, // 7 days absolute timeout
  },
  
  // File upload restrictions
  fileUpload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
  },
  
  // API security
  api: {
    maxRequestSize: 1024 * 1024, // 1MB
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
  },
  
  // Content Security
  content: {
    maxInputLength: 10000,
    maxTextAreaLength: 50000,
    allowedHtmlTags: [], // No HTML allowed by default
  },
};

/**
 * Security audit log levels
 */
export enum SecurityAuditLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Log security event
 */
export function logSecurityEvent(
  level: SecurityAuditLevel,
  event: string,
  details: Record<string, any>
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  
  // In production, send to monitoring service
  if (securityConfig.NODE_ENV === 'production') {
    // TODO: Send to Sentry, DataDog, or other monitoring service
    console.log('[SECURITY AUDIT]', JSON.stringify(logEntry));
  } else {
    console.log('[SECURITY AUDIT]', logEntry);
  }
}

/**
 * Security validation helpers
 */
export const securityValidators = {
  /**
   * Validate email address
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length < 255;
  },
  
  /**
   * Validate URL
   */
  isValidUrl: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },
  
  /**
   * Sanitize user input
   */
  sanitizeInput: (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove HTML brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .slice(0, securityPolicies.content.maxInputLength);
  },
  
  /**
   * Check for SQL injection patterns
   */
  hasSQLInjectionPattern: (input: string): boolean => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(\bOR\b.*=.*)/i,
      /('.*\bOR\b.*')/i,
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  },
  
  /**
   * Check for XSS patterns
   */
  hasXSSPattern: (input: string): boolean => {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*onerror=/gi,
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  },
};

/**
 * Security best practices checklist
 */
export const securityChecklist = {
  authentication: [
    'Use strong password requirements',
    'Implement account lockout after failed attempts',
    'Use secure session management',
    'Implement MFA for sensitive operations',
    'Regular password rotation',
  ],
  
  authorization: [
    'Implement role-based access control (RBAC)',
    'Verify permissions on every request',
    'Use principle of least privilege',
    'Regular permission audits',
  ],
  
  dataProtection: [
    'Encrypt sensitive data at rest',
    'Use TLS for data in transit',
    'Implement field-level encryption for PII',
    'Regular data retention reviews',
    'Secure key management',
  ],
  
  apiSecurity: [
    'Rate limiting on all endpoints',
    'Input validation and sanitization',
    'CSRF protection for state-changing operations',
    'API versioning and deprecation',
    'Request signing for sensitive operations',
  ],
  
  monitoring: [
    'Real-time security alerting',
    'Comprehensive audit logging',
    'Regular vulnerability scanning',
    'Dependency security updates',
    'Incident response procedures',
  ],
};