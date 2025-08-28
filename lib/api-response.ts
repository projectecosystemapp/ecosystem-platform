/**
 * API Response Utilities
 * 
 * Standardized response helpers that enforce the ApiResponse<T> pattern
 * across all API endpoints for consistent error handling and type safety.
 */

import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import type { ApiResponse as ApiResponseType, ApiError, ErrorCode } from '@/types/core';

// Re-export types for convenience
export type ApiResponse<T = any> = ApiResponseType<T>;
export type { ApiError, ErrorCode } from '@/types/core';

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiResponseType<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    } satisfies ApiResponseType<T>,
    { status }
  );
}

/**
 * Create an error API response
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number = 400,
  details?: Record<string, any>
): NextResponse<ApiResponseType<never>> {
  const error: ApiError = {
    code,
    message,
    details,
    timestamp: new Date(),
  };

  return NextResponse.json(
    {
      success: false,
      error,
    } satisfies ApiResponseType<never>,
    { status }
  );
}

/**
 * Handle Zod validation errors
 */
export function validationErrorResponse(
  error: ZodError
): NextResponse<ApiResponseType<never>> {
  const details = error.issues.reduce((acc, err) => {
    const path = err.path.join('.');
    acc[path] = err.message;
    return acc;
  }, {} as Record<string, string>);

  return errorResponse(
    'VALIDATION_ERROR',
    'Invalid request data',
    400,
    details
  );
}

/**
 * Handle database errors
 */
export function databaseErrorResponse(
  error: unknown
): NextResponse<ApiResponseType<never>> {
  console.error('Database error:', error);
  
  if (error instanceof Error && error.message.includes('unique constraint')) {
    return errorResponse(
      'CONFLICT',
      'Resource already exists',
      409
    );
  }

  return errorResponse(
    'DATABASE_ERROR',
    'A database error occurred',
    500
  );
}

/**
 * Handle Stripe errors
 */
export function stripeErrorResponse(
  error: unknown
): NextResponse<ApiResponseType<never>> {
  console.error('Stripe error:', error);
  
  if (error && typeof error === 'object' && 'type' in error) {
    const stripeError = error as any;
    
    if (stripeError.type === 'StripeCardError') {
      return errorResponse(
        'PAYMENT_FAILED',
        stripeError.message || 'Payment failed',
        402,
        { decline_code: stripeError.decline_code }
      );
    }
    
    if (stripeError.type === 'StripeInvalidRequestError') {
      return errorResponse(
        'BAD_REQUEST',
        stripeError.message || 'Invalid payment request',
        400
      );
    }
  }

  return errorResponse(
    'EXTERNAL_SERVICE_ERROR',
    'Payment processing error',
    500
  );
}

/**
 * Handle authentication errors
 */
export function unauthorizedResponse(
  message: string = 'Authentication required'
): NextResponse<ApiResponseType<never>> {
  return errorResponse('UNAUTHORIZED', message, 401);
}

/**
 * Handle authorization errors
 */
export function forbiddenResponse(
  message: string = 'Insufficient permissions'
): NextResponse<ApiResponseType<never>> {
  return errorResponse('FORBIDDEN', message, 403);
}

/**
 * Handle not found errors
 */
export function notFoundResponse(
  resource: string = 'Resource'
): NextResponse<ApiResponseType<never>> {
  return errorResponse('NOT_FOUND', `${resource} not found`, 404);
}

/**
 * Handle rate limit errors
 */
export function rateLimitResponse(): NextResponse<ApiResponseType<never>> {
  return errorResponse(
    'RATE_LIMITED',
    'Too many requests. Please try again later.',
    429
  );
}

/**
 * Validate request body with Zod schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T | NextResponse<ApiResponseType<never>>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      return validationErrorResponse(result.error);
    }
    
    return result.data;
  } catch (error) {
    return errorResponse(
      'BAD_REQUEST',
      'Invalid JSON in request body',
      400
    );
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): T | NextResponse<ApiResponseType<never>> {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);
  
  if (!result.success) {
    return validationErrorResponse(result.error);
  }
  
  return result.data;
}

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandling<T>(
  handler: (request: Request) => Promise<NextResponse<ApiResponseType<T>>>
) {
  return async (request: Request): Promise<NextResponse<ApiResponseType<T | never>>> => {
    try {
      return await handler(request);
    } catch (error) {
      console.error('Unhandled API error:', error);
      
      if (error instanceof Error) {
        // Check for known error types
        if (error.message.includes('Unauthorized')) {
          return unauthorizedResponse();
        }
        
        if (error.message.includes('Not found')) {
          return notFoundResponse();
        }
      }
      
      // Generic internal error
      return errorResponse(
        'INTERNAL_ERROR',
        'An internal server error occurred',
        500
      );
    }
  };
}

/**
 * Alternative name for withErrorHandling to match import expectations
 */
export const withErrorHandler = withErrorHandling;

/**
 * Extract pagination parameters from URL search params
 */
export function getPaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse<T>(
  response: T | NextResponse<ApiResponseType<never>>
): response is NextResponse<ApiResponseType<never>> {
  return response instanceof NextResponse;
}

/**
 * Extract data from API response or throw
 */
export async function extractResponseData<T>(
  response: Response
): Promise<T> {
  const json = await response.json() as ApiResponse<T>;
  
  if (!json.success) {
    throw new Error(json.error.message);
  }
  
  return json.data;
}