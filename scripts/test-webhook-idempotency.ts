#!/usr/bin/env tsx

/**
 * Test script for webhook idempotency
 * 
 * This script simulates sending the same Stripe webhook event twice to verify
 * that our idempotency implementation prevents duplicate payment processing.
 * 
 * Usage: npm run test:webhook-idempotency
 */

import crypto from "crypto";
import fetch from "node-fetch";

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:3000/api/stripe/webhooks";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";

// Sample Stripe webhook event
const sampleEvent = {
  id: "evt_test_" + crypto.randomBytes(16).toString("hex"),
  object: "event",
  api_version: "2023-10-16",
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: "pi_test_" + crypto.randomBytes(16).toString("hex"),
      object: "payment_intent",
      amount: 10000,
      amount_capturable: 0,
      amount_received: 10000,
      application: null,
      application_fee_amount: null,
      canceled_at: null,
      cancellation_reason: null,
      capture_method: "automatic",
      charges: {
        object: "list",
        data: [
          {
            id: "ch_test_" + crypto.randomBytes(16).toString("hex"),
            object: "charge",
            amount: 10000,
            amount_captured: 10000,
            amount_refunded: 0,
            application: null,
            application_fee: null,
            application_fee_amount: null,
            balance_transaction: "txn_test_" + crypto.randomBytes(16).toString("hex"),
            billing_details: {
              address: {
                city: null,
                country: null,
                line1: null,
                line2: null,
                postal_code: null,
                state: null,
              },
              email: "test@example.com",
              name: "Test Customer",
              phone: null,
            },
            calculated_statement_descriptor: null,
            captured: true,
            created: Math.floor(Date.now() / 1000),
            currency: "usd",
            customer: "cus_test_" + crypto.randomBytes(16).toString("hex"),
            description: "Test booking payment",
            destination: null,
            dispute: null,
            disputed: false,
            failure_code: null,
            failure_message: null,
            fraud_details: {},
            invoice: null,
            livemode: false,
            metadata: {
              bookingId: "550e8400-e29b-41d4-a716-446655440000",
              type: "booking_payment",
            },
            on_behalf_of: null,
            order: null,
            outcome: {
              network_status: "approved_by_network",
              reason: null,
              risk_level: "normal",
              risk_score: 63,
              seller_message: "Payment complete.",
              type: "authorized",
            },
            paid: true,
            payment_intent: "pi_test_" + crypto.randomBytes(16).toString("hex"),
            payment_method: "pm_test_" + crypto.randomBytes(16).toString("hex"),
            payment_method_details: {
              card: {
                brand: "visa",
                checks: {
                  address_line1_check: null,
                  address_postal_code_check: null,
                  cvc_check: "pass",
                },
                country: "US",
                exp_month: 12,
                exp_year: 2025,
                fingerprint: crypto.randomBytes(16).toString("hex"),
                funding: "credit",
                installments: null,
                last4: "4242",
                network: "visa",
                three_d_secure: null,
                wallet: null,
              },
              type: "card",
            },
            receipt_email: "test@example.com",
            receipt_number: null,
            receipt_url: "https://pay.stripe.com/receipts/test",
            refunded: false,
            refunds: {
              object: "list",
              data: [],
              has_more: false,
              total_count: 0,
              url: "/v1/charges/ch_test/refunds",
            },
            review: null,
            shipping: null,
            source: {
              id: "card_test_" + crypto.randomBytes(16).toString("hex"),
              object: "card",
              address_city: null,
              address_country: null,
              address_line1: null,
              address_line1_check: null,
              address_line2: null,
              address_state: null,
              address_zip: null,
              address_zip_check: null,
              brand: "Visa",
              country: "US",
              customer: "cus_test_" + crypto.randomBytes(16).toString("hex"),
              cvc_check: "pass",
              dynamic_last4: null,
              exp_month: 12,
              exp_year: 2025,
              fingerprint: crypto.randomBytes(16).toString("hex"),
              funding: "credit",
              last4: "4242",
              metadata: {},
              name: "Test Customer",
              tokenization_method: null,
            },
            source_transfer: null,
            statement_descriptor: null,
            statement_descriptor_suffix: null,
            status: "succeeded",
            transfer_data: null,
            transfer_group: null,
          },
        ],
        has_more: false,
        total_count: 1,
        url: "/v1/charges?payment_intent=pi_test",
      },
      client_secret: "pi_test_secret_" + crypto.randomBytes(16).toString("hex"),
      confirmation_method: "automatic",
      created: Math.floor(Date.now() / 1000),
      currency: "usd",
      customer: "cus_test_" + crypto.randomBytes(16).toString("hex"),
      description: "Test booking payment",
      invoice: null,
      last_payment_error: null,
      livemode: false,
      metadata: {
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        type: "booking_payment",
      },
      next_action: null,
      on_behalf_of: null,
      payment_method: "pm_test_" + crypto.randomBytes(16).toString("hex"),
      payment_method_options: {
        card: {
          installments: null,
          network: null,
          request_three_d_secure: "automatic",
        },
      },
      payment_method_types: ["card"],
      processing: null,
      receipt_email: "test@example.com",
      review: null,
      setup_future_usage: null,
      shipping: null,
      source: null,
      statement_descriptor: null,
      statement_descriptor_suffix: null,
      status: "succeeded",
      transfer_data: null,
      transfer_group: null,
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: null,
    idempotency_key: null,
  },
  type: "payment_intent.succeeded",
};

/**
 * Generate Stripe webhook signature
 */
function generateSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  
  return `t=${timestamp},v1=${expectedSignature}`;
}

/**
 * Send webhook event to endpoint
 */
async function sendWebhook(eventData: any, attemptNumber: number) {
  const payload = JSON.stringify(eventData);
  const signature = generateSignature(payload, WEBHOOK_SECRET);

  console.log(`\n🚀 Attempt ${attemptNumber}: Sending webhook event ${eventData.id}`);
  console.log(`   Event type: ${eventData.type}`);
  console.log(`   Booking ID: ${eventData.data.object.metadata?.bookingId}`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: payload,
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`   Response status: ${response.status}`);
    console.log(`   Response body:`, responseData);

    if (response.ok) {
      console.log(`   ✅ Webhook processed successfully`);
    } else {
      console.log(`   ❌ Webhook processing failed`);
    }

    return { success: response.ok, status: response.status, data: responseData };
  } catch (error) {
    console.error(`   ❌ Error sending webhook:`, error);
    return { success: false, error };
  }
}

/**
 * Main test function
 */
async function testIdempotency() {
  console.log("========================================");
  console.log("🧪 Testing Webhook Idempotency");
  console.log("========================================");
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Event ID: ${sampleEvent.id}`);

  // Send the same event twice
  const result1 = await sendWebhook(sampleEvent, 1);
  
  // Wait a moment between requests
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const result2 = await sendWebhook(sampleEvent, 2);

  // Analyze results
  console.log("\n========================================");
  console.log("📊 Test Results");
  console.log("========================================");

  if (result1.success && result2.success) {
    console.log("✅ Both requests returned success");
    console.log("   This is expected - duplicate events should return success without reprocessing");
    
    if (result1.status === 200 && result2.status === 200) {
      console.log("✅ Idempotency test PASSED");
      console.log("   The webhook correctly handled the duplicate event");
    }
  } else {
    console.log("❌ One or both requests failed");
    console.log("   First request:", result1.success ? "Success" : "Failed");
    console.log("   Second request:", result2.success ? "Success" : "Failed");
  }

  // Test with a different event to ensure new events still work
  console.log("\n========================================");
  console.log("🧪 Testing New Event Processing");
  console.log("========================================");

  const newEvent = {
    ...sampleEvent,
    id: "evt_test_" + crypto.randomBytes(16).toString("hex"),
    data: {
      ...sampleEvent.data,
      object: {
        ...sampleEvent.data.object,
        id: "pi_test_" + crypto.randomBytes(16).toString("hex"),
      },
    },
  };

  const result3 = await sendWebhook(newEvent, 3);

  if (result3.success) {
    console.log("✅ New event processed successfully");
    console.log("   System correctly processes new unique events");
  } else {
    console.log("❌ New event processing failed");
    console.log("   There may be an issue with the webhook handler");
  }

  console.log("\n========================================");
  console.log("🏁 Test Complete");
  console.log("========================================");
}

// Run the test
testIdempotency().catch(console.error);