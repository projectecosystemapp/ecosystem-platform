import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export class ApiResponse {
  static success<T>(
    data: T,
    message?: string,
    statusCode: number = 200
  ): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        message,
      },
      { status: statusCode }
    );
  }

  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number,
    statusCode: number = 200
  ): NextResponse<ApiSuccessResponse<PaginatedResponse<T>>> {
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return NextResponse.json(
      {
        success: true,
        data: {
          items,
          pagination: {
            total,
            page,
            pageSize,
            totalPages,
            hasNext,
            hasPrevious,
          },
        },
      },
      { status: statusCode }
    );
  }

  static error(
    message: string,
    code?: string,
    details?: any,
    statusCode: number = 400
  ): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error: {
          message,
          code,
          details,
        },
      },
      { status: statusCode }
    );
  }

  static unauthorized(message: string = "Unauthorized"): NextResponse<ApiErrorResponse> {
    return this.error(message, "UNAUTHORIZED", null, 401);
  }

  static forbidden(message: string = "Forbidden"): NextResponse<ApiErrorResponse> {
    return this.error(message, "FORBIDDEN", null, 403);
  }

  static notFound(resource: string): NextResponse<ApiErrorResponse> {
    return this.error(`${resource} not found`, "NOT_FOUND", null, 404);
  }

  static conflict(message: string, details?: any): NextResponse<ApiErrorResponse> {
    return this.error(message, "CONFLICT", details, 409);
  }

  static validationError(errors: any): NextResponse<ApiErrorResponse> {
    return this.error("Validation error", "VALIDATION_ERROR", errors, 422);
  }

  static serverError(
    message: string = "Internal server error",
    details?: any
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, "SERVER_ERROR", details, 500);
  }

  static rateLimitExceeded(
    resetTime?: Date
  ): NextResponse<ApiErrorResponse> {
    return this.error(
      "Rate limit exceeded",
      "RATE_LIMIT_EXCEEDED",
      { resetTime },
      429
    );
  }

  static created<T>(
    data: T,
    message?: string
  ): NextResponse<ApiSuccessResponse<T>> {
    return this.success(data, message, 201);
  }

  static noContent(): NextResponse {
    return new NextResponse(null, { status: 204 });
  }
}

// Pagination helper
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const offset = (page - 1) * pageSize;
  
  return { page, pageSize, offset, limit: pageSize };
}

// Error handling wrapper
export async function withErrorHandler<T>(
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error("API Error:", error);
    
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes("duplicate key")) {
        return ApiResponse.conflict("Resource already exists");
      }
      if (error.message.includes("foreign key")) {
        return ApiResponse.validationError({ 
          message: "Invalid reference to related resource" 
        });
      }
      if (error.message.includes("not found")) {
        return ApiResponse.notFound("Resource");
      }
    }
    
    return ApiResponse.serverError();
  }
}