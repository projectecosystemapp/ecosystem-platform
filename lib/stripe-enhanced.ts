import Stripe from "stripe";
import crypto from "crypto";
import { db } from "@/db/db";
import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { eq, and, gte, lt } from "drizzle-orm";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is required. Please add it to your .env.local file.\n" +
    "Get your key from: https://dashboard.stripe.com/test/apikeys"
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil" as any,
  appInfo: {
    name: "Ecosystem Marketplace",
    version: "1.0.0",
    url: "https://ecosystem-platform.com"
  }
});

// Idempotency keys table schema
export const idempotencyKeysTable = pgTable("idempotency_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  operation: text("operation").notNull(), // payment_intent, refund, transfer, etc.
  resourceId: text("resource_id"), // Stripe resource ID after successful operation
  status: text("status", { 
    enum: ["pending", "completed", "failed"] as const 
  }).default("pending").notNull(),
  response: text("response"), // JSON string of the response
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type for idempotency key record
export type IdempotencyKey = typeof idempotencyKeysTable.$inferSelect;

/**
 * Generate a unique idempotency key for Stripe operations
 */
export function generateIdempotencyKey(
  operation: string,
  uniqueIdentifier: string,
  additionalData?: Record<string, any>
): string {
  const timestamp = Date.now();
  const dataString = JSON.stringify({
    operation,
    uniqueIdentifier,
    timestamp,
    ...additionalData
  });
  
  return crypto
    .createHash('sha256')
    .update(dataString)
    .digest('hex')
    .substring(0, 64); // Stripe accepts up to 255 chars, but 64 is sufficient
}

/**
 * Store idempotency key in database
 */
async function storeIdempotencyKey(
  key: string,
  operation: string,
  expirationHours: number = 24
): Promise<void> {
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
  
  try {
    await db.insert(idempotencyKeysTable).values({
      key,
      operation,
      expiresAt,
    }).onConflictDoNothing(); // Key already exists, that's fine
  } catch (error) {
    console.error("Error storing idempotency key:", error);
    // Don't throw - we can still proceed with the operation
  }
}

/**
 * Check if an idempotency key has been used
 */
async function checkIdempotencyKey(key: string): Promise<IdempotencyKey | null> {
  try {
    const [record] = await db
      .select()
      .from(idempotencyKeysTable)
      .where(
        and(
          eq(idempotencyKeysTable.key, key),
          gte(idempotencyKeysTable.expiresAt, new Date())
        )
      )
      .limit(1);
    
    return record || null;
  } catch (error) {
    console.error("Error checking idempotency key:", error);
    return null;
  }
}

/**
 * Update idempotency key after successful operation
 */
async function updateIdempotencyKey(
  key: string,
  resourceId: string,
  response: any,
  status: "completed" | "failed"
): Promise<void> {
  try {
    await db
      .update(idempotencyKeysTable)
      .set({
        resourceId,
        response: JSON.stringify(response),
        status,
        used: true,
      })
      .where(eq(idempotencyKeysTable.key, key));
  } catch (error) {
    console.error("Error updating idempotency key:", error);
  }
}

/**
 * Enhanced payment intent creation with idempotency and retry logic
 */
export async function createPaymentIntentWithIdempotency(params: {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  stripeConnectAccountId?: string;
  platformFeeAmount?: number; // in cents
  metadata?: Record<string, string>;
  bookingId: string; // Required for idempotency
}): Promise<Stripe.PaymentIntent> {
  const idempotencyKey = generateIdempotencyKey(
    "payment_intent",
    params.bookingId,
    { amount: params.amount }
  );

  // Check if this key has been used before
  const existingKey = await checkIdempotencyKey(idempotencyKey);
  if (existingKey?.used && existingKey.resourceId) {
    // Return the existing payment intent
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(existingKey.resourceId);
      return paymentIntent;
    } catch (error) {
      console.error("Error retrieving existing payment intent:", error);
      // Fall through to create a new one
    }
  }

  // Store the key
  await storeIdempotencyKey(idempotencyKey, "payment_intent");

  // Retry logic with exponential backoff
  let retries = 3;
  let lastError: any;

  while (retries > 0) {
    try {
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: params.amount,
        currency: params.currency,
        customer: params.customerId,
        metadata: {
          type: "marketplace_booking",
          bookingId: params.bookingId,
          ...params.metadata,
        },
      };

      // Add Connect params if provided
      if (params.stripeConnectAccountId && params.platformFeeAmount) {
        paymentIntentParams.application_fee_amount = params.platformFeeAmount;
        paymentIntentParams.transfer_data = {
          destination: params.stripeConnectAccountId,
        };
      }

      const paymentIntent = await stripe.paymentIntents.create(
        paymentIntentParams,
        { idempotencyKey }
      );

      // Update the key record with success
      await updateIdempotencyKey(
        idempotencyKey,
        paymentIntent.id,
        paymentIntent,
        "completed"
      );

      return paymentIntent;

    } catch (error: any) {
      lastError = error;
      retries--;

      if (error.type === 'idempotency_error') {
        // The request was already processed, retrieve the result
        const response = error.raw?.payment_intent;
        if (response) {
          await updateIdempotencyKey(idempotencyKey, response.id, response, "completed");
          return response;
        }
      }

      if (retries > 0) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  await updateIdempotencyKey(idempotencyKey, "", lastError, "failed");
  throw lastError;
}

/**
 * Enhanced refund creation with idempotency
 */
export async function createRefundWithIdempotency(params: {
  paymentIntentId: string;
  amount?: number; // in cents, optional for partial refunds
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  metadata?: Record<string, string>;
  bookingId: string; // Required for idempotency
  refundApplicationFee?: boolean;
}): Promise<Stripe.Refund> {
  const idempotencyKey = generateIdempotencyKey(
    "refund",
    params.bookingId,
    { amount: params.amount, timestamp: Date.now() }
  );

  // Check if this key has been used before
  const existingKey = await checkIdempotencyKey(idempotencyKey);
  if (existingKey?.used && existingKey.resourceId) {
    try {
      const refund = await stripe.refunds.retrieve(existingKey.resourceId);
      return refund;
    } catch (error) {
      console.error("Error retrieving existing refund:", error);
    }
  }

  // Store the key
  await storeIdempotencyKey(idempotencyKey, "refund");

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: params.amount,
        reason: params.reason || "requested_by_customer",
        metadata: params.metadata,
        refund_application_fee: params.refundApplicationFee,
      },
      { idempotencyKey }
    );

    await updateIdempotencyKey(idempotencyKey, refund.id, refund, "completed");
    return refund;

  } catch (error: any) {
    await updateIdempotencyKey(idempotencyKey, "", error, "failed");
    throw error;
  }
}

/**
 * Enhanced transfer creation with idempotency
 */
export async function createTransferWithIdempotency(params: {
  amount: number; // in cents
  currency: string;
  destination: string; // Connected account ID
  transferGroup?: string;
  description?: string;
  metadata?: Record<string, string>;
  bookingId: string; // Required for idempotency
}): Promise<Stripe.Transfer> {
  const idempotencyKey = generateIdempotencyKey(
    "transfer",
    params.bookingId,
    { amount: params.amount, destination: params.destination }
  );

  // Check if this key has been used before
  const existingKey = await checkIdempotencyKey(idempotencyKey);
  if (existingKey?.used && existingKey.resourceId) {
    try {
      const transfer = await stripe.transfers.retrieve(existingKey.resourceId);
      return transfer;
    } catch (error) {
      console.error("Error retrieving existing transfer:", error);
    }
  }

  // Store the key
  await storeIdempotencyKey(idempotencyKey, "transfer");

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: params.amount,
        currency: params.currency,
        destination: params.destination,
        transfer_group: params.transferGroup || `booking_${params.bookingId}`,
        description: params.description,
        metadata: params.metadata,
      },
      { idempotencyKey }
    );

    await updateIdempotencyKey(idempotencyKey, transfer.id, transfer, "completed");
    return transfer;

  } catch (error: any) {
    await updateIdempotencyKey(idempotencyKey, "", error, "failed");
    throw error;
  }
}

/**
 * Clean up expired idempotency keys (run periodically)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await db
      .delete(idempotencyKeysTable)
      .where(lt(idempotencyKeysTable.expiresAt, new Date()))
      .returning();
    
    return result.length;
  } catch (error) {
    console.error("Error cleaning up expired idempotency keys:", error);
    return 0;
  }
}

// Re-export existing functions from original stripe.ts for backward compatibility
export { 
  createConnectedAccount,
  getAccountStatus,
  createAccountOnboardingLink,
  createConnectedAccountProduct,
  listConnectedAccountProducts,
  createConnectedAccountCheckout,
} from "./stripe";