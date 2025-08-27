// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/db";
import { 
  customerSubscriptionsTable, 
  subscriptionPlansTable,
  subscriptionUsageTable,
  type CustomerSubscription,
  type NewSubscriptionUsage
} from "@/db/schema/subscriptions-schema";
import { paymentsTable } from "@/db/schema/payments-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, lte, gte, isNull, or, sql } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

/**
 * Cron job endpoint for processing subscription billing
 * Handles recurring charges, failed payment retries, and subscription period updates
 * 
 * Schedule recommendation: Run daily at 2 AM
 * Cron expression: 0 2 * * *
 */
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = headers().get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron job not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const startTime = new Date();
    console.log(`[CRON] Starting subscription processing at ${startTime.toISOString()}`);
    
    // Process subscriptions due for renewal
    const renewalResults = await processSubscriptionRenewals();
    
    // Retry failed subscription payments
    const retryResults = await retryFailedSubscriptionPayments();
    
    // Update subscription statuses based on payment history
    const statusUpdateResults = await updateSubscriptionStatuses();
    
    // Cancel subscriptions marked for cancellation at period end
    const cancellationResults = await processPendingCancellations();
    
    // Resume paused subscriptions if resume date is reached
    const resumeResults = await resumePausedSubscriptions();
    
    // Send renewal reminders (3 days before renewal)
    const reminderResults = await sendRenewalReminders();
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Compile results
    const result = {
      success: true,
      timestamp: startTime.toISOString(),
      duration: `${duration}ms`,
      renewals: renewalResults,
      retries: retryResults,
      statusUpdates: statusUpdateResults,
      cancellations: cancellationResults,
      resumptions: resumeResults,
      reminders: reminderResults,
      nextRun: getNextRunTime(),
    };
    
    console.log(`[CRON] Subscription processing completed:`, result);

    // Log metrics for monitoring
    await logSubscriptionMetrics(result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Subscription cron job error:", error);
    
    // Send alert to admin
    await notifyAdminOfCronFailure("process-subscriptions", error);
    
    return NextResponse.json(
      { 
        error: "Subscription cron job failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Process subscriptions due for renewal
async function processSubscriptionRenewals() {
  const now = new Date();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  try {
    // Find subscriptions where current period has ended
    const dueSubscriptions = await db
      .select({
        subscription: customerSubscriptionsTable,
        plan: subscriptionPlansTable,
        profile: profilesTable
      })
      .from(customerSubscriptionsTable)
      .innerJoin(subscriptionPlansTable, eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id))
      .leftJoin(profilesTable, eq(customerSubscriptionsTable.customerId, profilesTable.userId))
      .where(
        and(
          eq(customerSubscriptionsTable.status, "active"),
          lte(customerSubscriptionsTable.currentPeriodEnd, now),
          eq(customerSubscriptionsTable.cancelAtPeriodEnd, false)
        )
      );

    for (const { subscription, plan, profile } of dueSubscriptions) {
      processed++;
      
      try {
        // Create invoice and charge via Stripe
        if (subscription.stripeSubscriptionId) {
          // Use Stripe's subscription billing
          const stripeInvoice = await stripe.invoices.create({
            customer: subscription.stripeCustomerId!,
            subscription: subscription.stripeSubscriptionId,
            auto_advance: true,
          });
          
          await stripe.invoices.pay(stripeInvoice.id);
          
          // Update subscription period
          const nextPeriodStart = new Date(subscription.currentPeriodEnd!);
          const nextPeriodEnd = calculateNextPeriodEnd(nextPeriodStart, plan.billingCycle);
          
          await db.update(customerSubscriptionsTable)
            .set({
              currentPeriodStart: nextPeriodStart,
              currentPeriodEnd: nextPeriodEnd,
              servicesUsedThisPeriod: 0, // Reset period usage
              updatedAt: new Date()
            })
            .where(eq(customerSubscriptionsTable.id, subscription.id));
          
          // Create usage record
          const usageRecord: NewSubscriptionUsage = {
            subscriptionId: subscription.id,
            periodStart: subscription.currentPeriodStart!,
            periodEnd: subscription.currentPeriodEnd!,
            servicesIncluded: plan.servicesPerCycle || 1,
            servicesUsed: subscription.servicesUsedThisPeriod || 0,
            servicesRemaining: (plan.servicesPerCycle || 1) - (subscription.servicesUsedThisPeriod || 0),
            amountBilledCents: plan.basePriceCents,
            stripeInvoiceId: stripeInvoice.id,
            isPaid: true,
            paidAt: new Date()
          };
          
          await db.insert(subscriptionUsageTable).values(usageRecord);
          
          // Record payment
          await db.insert(paymentsTable).values({
            userId: subscription.customerId,
            stripePaymentIntentId: stripeInvoice.payment_intent as string,
            stripeCustomerId: subscription.stripeCustomerId,
            amountCents: plan.basePriceCents,
            currency: "usd",
            status: "succeeded",
            paymentMethod: "subscription",
            metadata: {
              subscriptionId: subscription.id,
              planId: plan.id,
              periodStart: nextPeriodStart.toISOString(),
              periodEnd: nextPeriodEnd.toISOString()
            },
            processedAt: new Date()
          });
          
          succeeded++;
          
          // Send renewal confirmation
          await sendRenewalNotification(subscription.id, profile?.email || subscription.customerId, plan.name);
          
        } else {
          // Manual processing for non-Stripe subscriptions
          // This would integrate with your payment processor
          console.log(`Manual processing needed for subscription ${subscription.id}`);
        }
        
      } catch (chargeError: any) {
        failed++;
        console.error(`Failed to renew subscription ${subscription.id}:`, chargeError);
        
        // Update subscription status to past_due
        await db.update(customerSubscriptionsTable)
          .set({
            status: "past_due",
            updatedAt: new Date()
          })
          .where(eq(customerSubscriptionsTable.id, subscription.id));
        
        // Send payment failed notification
        await sendPaymentFailedNotification(subscription.id, profile?.email || subscription.customerId);
      }
    }
    
  } catch (error) {
    console.error("Error processing subscription renewals:", error);
  }
  
  return { processed, succeeded, failed };
}

// Retry failed subscription payments
async function retryFailedSubscriptionPayments() {
  let retried = 0;
  let succeeded = 0;
  
  try {
    // Find past_due subscriptions for retry
    const pastDueSubscriptions = await db
      .select({
        subscription: customerSubscriptionsTable,
        plan: subscriptionPlansTable
      })
      .from(customerSubscriptionsTable)
      .innerJoin(subscriptionPlansTable, eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id))
      .where(eq(customerSubscriptionsTable.status, "past_due"));

    for (const { subscription, plan } of pastDueSubscriptions) {
      retried++;
      
      // Check retry count (max 3 retries over 7 days)
      const retryCount = (subscription.metadata as any)?.retryCount || 0;
      if (retryCount >= 3) {
        // Cancel subscription after max retries
        await db.update(customerSubscriptionsTable)
          .set({
            status: "canceled",
            canceledAt: new Date(),
            cancelationReason: "Payment failed after multiple retries",
            updatedAt: new Date()
          })
          .where(eq(customerSubscriptionsTable.id, subscription.id));
        
        continue;
      }
      
      try {
        // Retry payment via Stripe
        if (subscription.stripeSubscriptionId) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          const latestInvoice = await stripe.invoices.retrieve(stripeSubscription.latest_invoice as string);
          
          if (!latestInvoice.paid) {
            await stripe.invoices.pay(latestInvoice.id);
            
            // Update subscription back to active
            await db.update(customerSubscriptionsTable)
              .set({
                status: "active",
                metadata: { ...(subscription.metadata as any), retryCount: 0 },
                updatedAt: new Date()
              })
              .where(eq(customerSubscriptionsTable.id, subscription.id));
            
            succeeded++;
          }
        }
        
      } catch (retryError: any) {
        // Increment retry count
        await db.update(customerSubscriptionsTable)
          .set({
            metadata: { ...(subscription.metadata as any), retryCount: retryCount + 1 },
            updatedAt: new Date()
          })
          .where(eq(customerSubscriptionsTable.id, subscription.id));
        
        console.error(`Retry failed for subscription ${subscription.id}:`, retryError);
      }
    }
    
  } catch (error) {
    console.error("Error retrying failed payments:", error);
  }
  
  return { retried, succeeded };
}

// Update subscription statuses based on various conditions
async function updateSubscriptionStatuses() {
  let updated = 0;
  
  try {
    // End trial periods
    const trialEndedCount = await db
      .update(customerSubscriptionsTable)
      .set({
        status: "active",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(customerSubscriptionsTable.status, "trialing"),
          lte(customerSubscriptionsTable.trialEnd, new Date())
        )
      );
    
    updated += trialEndedCount.length || 0;
    
  } catch (error) {
    console.error("Error updating subscription statuses:", error);
  }
  
  return { updated };
}

// Process pending cancellations
async function processPendingCancellations() {
  let cancelled = 0;
  
  try {
    const now = new Date();
    
    const toCancel = await db
      .update(customerSubscriptionsTable)
      .set({
        status: "canceled",
        canceledAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(customerSubscriptionsTable.cancelAtPeriodEnd, true),
          lte(customerSubscriptionsTable.currentPeriodEnd, now)
        )
      )
      .returning();
    
    cancelled = toCancel.length;
    
    // Cancel in Stripe
    for (const subscription of toCancel) {
      if (subscription.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } catch (error) {
          console.error(`Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error("Error processing cancellations:", error);
  }
  
  return { cancelled };
}

// Resume paused subscriptions
async function resumePausedSubscriptions() {
  let resumed = 0;
  
  try {
    const now = new Date();
    
    const toResume = await db
      .update(customerSubscriptionsTable)
      .set({
        status: "active",
        pausedAt: null,
        pauseReason: null,
        resumeAt: null,
        updatedAt: now
      })
      .where(
        and(
          eq(customerSubscriptionsTable.status, "paused"),
          lte(customerSubscriptionsTable.resumeAt, now)
        )
      )
      .returning();
    
    resumed = toResume.length;
    
  } catch (error) {
    console.error("Error resuming subscriptions:", error);
  }
  
  return { resumed };
}

// Send renewal reminders
async function sendRenewalReminders() {
  let sent = 0;
  
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const upcomingRenewals = await db
      .select({
        subscription: customerSubscriptionsTable,
        plan: subscriptionPlansTable,
        profile: profilesTable
      })
      .from(customerSubscriptionsTable)
      .innerJoin(subscriptionPlansTable, eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id))
      .leftJoin(profilesTable, eq(customerSubscriptionsTable.customerId, profilesTable.userId))
      .where(
        and(
          eq(customerSubscriptionsTable.status, "active"),
          gte(customerSubscriptionsTable.currentPeriodEnd, new Date()),
          lte(customerSubscriptionsTable.currentPeriodEnd, threeDaysFromNow),
          eq(customerSubscriptionsTable.cancelAtPeriodEnd, false)
        )
      );
    
    for (const { subscription, plan, profile } of upcomingRenewals) {
      // Check if reminder already sent (stored in metadata)
      const metadata = subscription.metadata as any;
      const reminderKey = `reminder_${subscription.currentPeriodEnd?.toISOString().split('T')[0]}`;
      
      if (!metadata?.[reminderKey]) {
        await sendRenewalReminderNotification(
          subscription.id,
          profile?.email || subscription.customerId,
          plan.name,
          subscription.currentPeriodEnd!
        );
        
        // Mark reminder as sent
        await db.update(customerSubscriptionsTable)
          .set({
            metadata: { ...metadata, [reminderKey]: true }
          })
          .where(eq(customerSubscriptionsTable.id, subscription.id));
        
        sent++;
      }
    }
    
  } catch (error) {
    console.error("Error sending renewal reminders:", error);
  }
  
  return { sent };
}

// Helper functions
function calculateNextPeriodEnd(startDate: Date, billingCycle: string): Date {
  const endDate = new Date(startDate);
  
  switch (billingCycle) {
    case "weekly":
      endDate.setDate(endDate.getDate() + 7);
      break;
    case "biweekly":
      endDate.setDate(endDate.getDate() + 14);
      break;
    case "monthly":
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case "quarterly":
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case "annual":
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    default:
      endDate.setMonth(endDate.getMonth() + 1); // Default to monthly
  }
  
  return endDate;
}

function getNextRunTime(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1); // Runs daily
  next.setHours(2, 0, 0, 0); // At 2 AM
  return next.toISOString();
}

// Notification functions (integrate with your notification service)
async function sendRenewalNotification(subscriptionId: string, email: string, planName: string) {
  console.log(`Sending renewal confirmation to ${email} for plan ${planName}`);
  // Integrate with your notification service
}

async function sendPaymentFailedNotification(subscriptionId: string, email: string) {
  console.log(`Sending payment failed notification to ${email}`);
  // Integrate with your notification service
}

async function sendRenewalReminderNotification(
  subscriptionId: string, 
  email: string, 
  planName: string, 
  renewalDate: Date
) {
  console.log(`Sending renewal reminder to ${email} for plan ${planName} on ${renewalDate}`);
  // Integrate with your notification service
}

async function logSubscriptionMetrics(result: any) {
  console.log("[METRICS] Subscription processing metrics:", {
    timestamp: result.timestamp,
    renewals: result.renewals,
    retries: result.retries,
    cancellations: result.cancellations,
  });
  
  // Send to analytics service if configured
  if (process.env.ANALYTICS_ENDPOINT) {
    try {
      await fetch(process.env.ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "subscription_cron_completed",
          properties: result
        })
      });
    } catch (error) {
      console.error("Failed to log metrics:", error);
    }
  }
}

async function notifyAdminOfCronFailure(job: string, error: any) {
  console.error(`CRON JOB FAILURE - Admin notification needed:`, {
    job,
    error: error.message,
    timestamp: new Date().toISOString(),
  });
  
  // Send alert to Slack webhook if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 ${job} Cron Job Failed`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Job:* ${job}\n*Error:* ${error.message}\n*Time:* ${new Date().toISOString()}`,
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.error("Failed to send Slack alert:", e);
    }
  }
}

// Health check endpoint for monitoring
export async function HEAD(req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}