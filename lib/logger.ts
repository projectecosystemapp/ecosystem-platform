/**
 * Structured Logging System
 * Production-ready logger with sanitization, request tracking, and multiple levels
 * Integrates with Sentry for error tracking and provides secure logging practices
 */

import { captureException, captureMessage, addBreadcrumb, isSentryConfigured } from './sentry';
import { headers } from 'next/headers';
import crypto from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  timestamp?: string;
  [key: string]: any;
}

interface LogMetadata {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private requestId: string;
  private isDevelopment: boolean;

  constructor() {
    this.requestId = this.generateRequestId();
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private generateRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private getRequestContext(): LogContext {
    try {
      const headersList = headers();
      const method = headersList.get('x-middleware-request-method') || 'UNKNOWN';
      const endpoint = headersList.get('x-pathname') || 'UNKNOWN';
      
      return {
        requestId: this.requestId,
        method,
        endpoint,
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Fallback for non-request contexts
      return {
        requestId: this.requestId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitive = [
      'password', 'token', 'secret', 'key', 'auth', 'credit_card', 
      'ssn', 'social_security', 'card_number', 'cvv', 'pin',
      'stripe_account_id', 'connect_account', 'api_key'
    ];

    const sanitized = { ...data };

    // Recursively sanitize object properties
    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key contains sensitive information
        const isSensitive = sensitive.some(s => lowerKey.includes(s));
        
        if (isSensitive) {
          sanitizedObj[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitizedObj[key] = sanitizeObject(value);
        } else {
          sanitizedObj[key] = value;
        }
      }
      
      return sanitizedObj;
    };

    return sanitizeObject(sanitized);
  }

  private formatLogEntry(metadata: LogMetadata): string {
    const context = { ...this.getRequestContext(), ...metadata.context };
    const sanitizedContext = this.sanitizeData(context);
    
    const logEntry = {
      level: metadata.level.toUpperCase(),
      message: metadata.message,
      ...sanitizedContext,
      ...(metadata.error && { 
        error: {
          name: metadata.error.name,
          message: metadata.error.message,
          stack: this.isDevelopment ? metadata.error.stack : undefined
        }
      })
    };

    return JSON.stringify(logEntry, null, this.isDevelopment ? 2 : 0);
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const metadata: LogMetadata = { level, message, context, error };
    const formattedEntry = this.formatLogEntry(metadata);

    // Console output for development
    if (this.isDevelopment) {
      const logMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : console.log;
      logMethod(formattedEntry);
    }

    // Send to Sentry based on level
    if (isSentryConfigured()) {
      if (level === 'error' && error) {
        captureException(error, {
          tags: { 
            endpoint: context?.endpoint,
            method: context?.method,
            requestId: context?.requestId 
          },
          extra: this.sanitizeData(context)
        });
      } else if (level === 'warn' || level === 'error') {
        captureMessage(message, level, this.sanitizeData(context));
      }

      // Add breadcrumb for all levels
      addBreadcrumb({
        message,
        level,
        category: 'log',
        data: this.sanitizeData({ ...context, requestId: this.requestId })
      });
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }

  // Method to create a child logger with additional context
  withContext(additionalContext: LogContext): Logger {
    const childLogger = new Logger();
    const originalGetRequestContext = childLogger.getRequestContext.bind(childLogger);
    
    childLogger.getRequestContext = () => ({
      ...originalGetRequestContext(),
      ...additionalContext
    });
    
    return childLogger;
  }

  // Method to start request tracking
  startRequest(endpoint: string, method: string, userId?: string): Logger {
    return this.withContext({
      endpoint,
      method,
      userId,
      requestId: this.generateRequestId()
    });
  }

  // Method for API route logging
  apiLog(level: LogLevel, message: string, data?: any, error?: Error): void {
    const context: LogContext = {
      ...this.sanitizeData(data),
      apiRoute: true
    };
    
    this.log(level, message, context, error);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export factory function for creating request-specific loggers
export const createRequestLogger = (endpoint: string, method: string, userId?: string): Logger => {
  return logger.startRequest(endpoint, method, userId);
};

// Helper functions for common logging patterns
export const logApiStart = (endpoint: string, method: string, data?: any): Logger => {
  const requestLogger = createRequestLogger(endpoint, method);
  requestLogger.info(`API request started: ${method} ${endpoint}`, { requestData: data });
  return requestLogger;
};

export const logApiSuccess = (logger: Logger, message: string, data?: any): void => {
  logger.info(message, { success: true, responseData: data });
};

export const logApiError = (logger: Logger, message: string, error: Error, data?: any): void => {
  logger.error(message, { success: false, errorData: data }, error);
};

// Development helper - only logs in development mode
export const devLog = (message: string, data?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(message, data);
  }
};