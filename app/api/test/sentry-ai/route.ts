/**
 * Sentry AI Integration Test API
 * 
 * This endpoint tests Sentry integration with AI operations
 * Temporarily simplified for TypeScript compilation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  try {
    const session = auth();
    const body = await request.json();
    const { operation, testError = false } = body;

    // Add user context to Sentry
    Sentry.setUser({
      id: session?.userId || 'anonymous',
      email: session?.sessionClaims?.email as string,
    });

    // Set additional context
    Sentry.setTag('ai_test', 'sentry_integration');
    Sentry.setContext('test_operation', {
      operation,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });

    let result;
    
    switch (operation) {
      case 'generateText':
        result = {
          text: 'Mock AI response for testing Sentry integration',
          usage: { totalTokens: 10 }
        };
        break;

      case 'generateObject':
        result = {
          object: { message: 'Mock object response' },
          usage: { totalTokens: 15 }
        };
        break;

      case 'streamText':
        result = {
          fullText: 'Mock streaming text response',
          usage: { totalTokens: 20 }
        };
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Simulate an error for testing error tracking
    if (testError) {
      throw new Error(`Simulated AI error for operation: ${operation}`);
    }
    
    return NextResponse.json({
      success: true,
      operation,
      result,
      sentryIntegration: 'active',
      message: 'Sentry AI integration test completed successfully',
    });

  } catch (error) {
    // Capture error in Sentry
    Sentry.captureException(error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sentryIntegration: 'active',
      message: 'Sentry AI integration test failed (error captured in Sentry)',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Sentry AI Integration Test Endpoint',
    availableOperations: [
      'generateText',
      'generateObject', 
      'streamText'
    ],
    usage: {
      method: 'POST',
      body: {
        operation: 'generateText | generateObject | streamText',
        testError: 'boolean (optional) - Set to true to test error handling'
      }
    }
  });
}