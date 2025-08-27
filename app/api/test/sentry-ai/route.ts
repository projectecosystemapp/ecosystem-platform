/**
 * Test endpoint for Sentry AI SDK integration
 * 
 * This endpoint simulates AI operations to verify that Sentry correctly captures:
 * - AI operation spans
 * - Input/output recording (when enabled)
 * - Error tracking for AI operations
 * - Performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@clerk/nextjs/server';
import { createSafeTelemetryConfig } from '@/lib/ai/telemetry-config';

// Mock AI SDK functions for testing
const mockGenerateText = async (options: {
  model: string;
  prompt: string;
  experimental_telemetry?: any;
}) => {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    text: `Mock response to: ${options.prompt}`,
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
  };
};

const mockGenerateObject = async (options: {
  model: string;
  schema: any;
  prompt: string;
  experimental_telemetry?: any;
}) => {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  return {
    object: {
      title: "Mock Generated Object",
      description: "This is a mock response for testing",
      category: "test",
    },
    usage: {
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40,
    },
  };
};

const mockStreamText = async (options: {
  model: string;
  prompt: string;
  experimental_telemetry?: any;
}) => {
  // Simulate streaming response
  return {
    textStream: (async function* () {
      const words = ["This", "is", "a", "mock", "streaming", "response"];
      for (const word of words) {
        await new Promise(resolve => setTimeout(resolve, 200));
        yield word + " ";
      }
    })(),
    usage: {
      promptTokens: 8,
      completionTokens: 6,
      totalTokens: 14,
    },
  };
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { operation, testError = false } = body;

    // Add user context to Sentry
    Sentry.setUser({
      id: session?.userId || 'anonymous',
      email: session?.user?.emailAddress,
    });

    // Set additional context
    Sentry.setTag('ai_test', 'sentry_integration');
    Sentry.setContext('test_operation', {
      operation,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });

    // Start a Sentry transaction to monitor the entire AI operation
    const transaction = Sentry.startTransaction({
      op: "ai_operation_test",
      name: `Test AI Operation: ${operation}`,
      data: {
        operation,
        userId: session?.userId,
      },
    });

    try {
      let result;
      
      const telemetryConfig = createSafeTelemetryConfig({
        context: {
          userId: session?.userId,
          operation,
          testMode: true,
        },
      });

      switch (operation) {
        case 'generateText':
          // Start a child span for the AI operation
          const textSpan = transaction.startChild({
            op: 'ai.generateText',
            description: 'Mock text generation',
          });
          
          try {
            result = await mockGenerateText({
              model: 'gpt-4o-mock',
              prompt: 'Generate a test response for Sentry integration',
              experimental_telemetry: telemetryConfig,
            });
            
            // Log successful operation
            Sentry.addBreadcrumb({
              message: 'AI text generation completed',
              category: 'ai.generateText',
              level: 'info',
              data: {
                usage: result.usage,
                model: 'gpt-4o-mock',
              },
            });
          } finally {
            textSpan.finish();
          }
          break;

        case 'generateObject':
          const objectSpan = transaction.startChild({
            op: 'ai.generateObject',
            description: 'Mock object generation',
          });
          
          try {
            result = await mockGenerateObject({
              model: 'gpt-4o-mock',
              schema: { type: 'object' },
              prompt: 'Generate a test object for Sentry integration',
              experimental_telemetry: telemetryConfig,
            });
            
            Sentry.addBreadcrumb({
              message: 'AI object generation completed',
              category: 'ai.generateObject',
              level: 'info',
              data: {
                usage: result.usage,
                objectKeys: Object.keys(result.object),
              },
            });
          } finally {
            objectSpan.finish();
          }
          break;

        case 'streamText':
          const streamSpan = transaction.startChild({
            op: 'ai.streamText',
            description: 'Mock text streaming',
          });
          
          try {
            const streamResult = await mockStreamText({
              model: 'gpt-4o-mock',
              prompt: 'Stream a test response for Sentry integration',
              experimental_telemetry: telemetryConfig,
            });
            
            // Collect the streamed text
            let fullText = '';
            for await (const chunk of streamResult.textStream) {
              fullText += chunk;
            }
            
            result = {
              text: fullText.trim(),
              usage: streamResult.usage,
              streaming: true,
            };
            
            Sentry.addBreadcrumb({
              message: 'AI text streaming completed',
              category: 'ai.streamText',
              level: 'info',
              data: {
                usage: result.usage,
                textLength: fullText.length,
              },
            });
          } finally {
            streamSpan.finish();
          }
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Simulate an error for testing error tracking
      if (testError) {
        throw new Error(`Simulated AI error for operation: ${operation}`);
      }

      // Set successful transaction status
      transaction.setStatus('ok');
      
      return NextResponse.json({
        success: true,
        operation,
        result,
        telemetryEnabled: telemetryConfig.isEnabled,
        sentryIntegration: 'active',
        message: 'Sentry AI integration test completed successfully',
      });

    } catch (error) {
      // Capture error in Sentry with AI context
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'ai_operation_error');
        scope.setContext('ai_operation', {
          operation,
          testMode: true,
          userId: session?.userId,
        });
        
        // Set transaction as failed
        transaction.setStatus('internal_error');
        
        Sentry.captureException(error);
      });

      return NextResponse.json({
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
        sentryIntegration: 'active',
        message: 'Sentry AI integration test failed (error captured in Sentry)',
      }, { status: 500 });

    } finally {
      // Always finish the transaction
      transaction.finish();
    }

  } catch (error) {
    console.error('Sentry AI test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to run Sentry AI integration test',
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
    },
    examples: [
      {
        operation: 'generateText',
        description: 'Test basic text generation with Sentry tracking'
      },
      {
        operation: 'generateObject',
        description: 'Test structured object generation with Sentry tracking'
      },
      {
        operation: 'streamText',
        testError: true,
        description: 'Test streaming with error simulation'
      }
    ]
  });
}