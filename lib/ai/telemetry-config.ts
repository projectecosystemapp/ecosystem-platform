/**
 * Vercel AI SDK Telemetry Configuration
 * 
 * This file provides standardized telemetry configuration for all Vercel AI SDK calls.
 * It ensures consistent tracking across the application and integrates with Sentry monitoring.
 */

/**
 * Standard telemetry configuration for AI SDK calls
 */
export const aiTelemetryConfig = {
  isEnabled: true,
  recordInputs: process.env.NODE_ENV === "development" ? true : false, // Only in dev to protect user privacy
  recordOutputs: process.env.NODE_ENV === "development" ? true : false, // Only in dev to protect sensitive data
};

/**
 * Enhanced telemetry configuration with user context
 * Use this when you need to include user information for debugging
 */
export const createAiTelemetryConfigWithContext = (context: {
  userId?: string;
  sessionId?: string;
  feature?: string;
  experimentId?: string;
}) => ({
  ...aiTelemetryConfig,
  metadata: {
    userId: context.userId,
    sessionId: context.sessionId,
    feature: context.feature,
    experimentId: context.experimentId,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  },
});

/**
 * Production-safe telemetry configuration
 * Use this in production to avoid recording sensitive data
 */
export const aiTelemetryConfigProduction = {
  isEnabled: true,
  recordInputs: false, // Never record inputs in production
  recordOutputs: false, // Never record outputs in production
};

/**
 * Example usage patterns for common AI operations
 */

// Example 1: Text generation with basic telemetry
/*
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { aiTelemetryConfig } from '@/lib/ai/telemetry-config';

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Tell me a joke",
  experimental_telemetry: aiTelemetryConfig,
});
*/

// Example 2: Object generation with user context
/*
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createAiTelemetryConfigWithContext } from '@/lib/ai/telemetry-config';

const result = await generateObject({
  model: openai("gpt-4o"),
  schema: mySchema,
  prompt: "Generate a product description",
  experimental_telemetry: createAiTelemetryConfigWithContext({
    userId: user.id,
    feature: "product-description-generator",
  }),
});
*/

// Example 3: Streaming with production safety
/*
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { aiTelemetryConfigProduction } from '@/lib/ai/telemetry-config';

const result = await streamText({
  model: openai("gpt-4o"),
  prompt: "Write a story",
  experimental_telemetry: process.env.NODE_ENV === 'production' 
    ? aiTelemetryConfigProduction 
    : aiTelemetryConfig,
});
*/

/**
 * Helper function to create telemetry config based on environment and user preferences
 */
export const createSafeTelemetryConfig = (options?: {
  recordInputs?: boolean;
  recordOutputs?: boolean;
  context?: Record<string, any>;
}) => {
  const isDevelopment = process.env.NODE_ENV === "development";
  
  return {
    isEnabled: true,
    recordInputs: isDevelopment && (options?.recordInputs ?? true),
    recordOutputs: isDevelopment && (options?.recordOutputs ?? true),
    metadata: {
      ...options?.context,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  };
};