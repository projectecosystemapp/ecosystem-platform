/**
 * Stripe Type Definitions
 * 
 * Re-export and extend Stripe SDK types for consistency.
 * This ensures we're always aligned with the Stripe API.
 */

import Stripe from 'stripe';

// Re-export core Stripe types
export type StripePaymentIntent = Stripe.PaymentIntent;
export type StripeCustomer = Stripe.Customer;
export type StripeSubscription = Stripe.Subscription;
export type StripeInvoice = Stripe.Invoice;
export type StripePaymentMethod = Stripe.PaymentMethod;
export type StripeRefund = Stripe.Refund;
export type StripePayout = Stripe.Payout;
export type StripeAccount = Stripe.Account;
export type StripePrice = Stripe.Price;
export type StripeProduct = Stripe.Product;
export type StripeCheckoutSession = Stripe.Checkout.Session;

// Webhook event types
export type StripeWebhookEvent = Stripe.Event;

// Common webhook event data types
export type PaymentIntentWebhookData = Stripe.PaymentIntent;
export type CustomerWebhookData = Stripe.Customer;
export type SubscriptionWebhookData = Stripe.Subscription;
export type InvoiceWebhookData = Stripe.Invoice;

// Webhook event type mapping
export interface StripeWebhookEventMap {
  // Payment events
  'payment_intent.succeeded': PaymentIntentWebhookData;
  'payment_intent.payment_failed': PaymentIntentWebhookData;
  'payment_intent.canceled': PaymentIntentWebhookData;
  'payment_intent.processing': PaymentIntentWebhookData;
  'payment_intent.requires_action': PaymentIntentWebhookData;
  
  // Customer events
  'customer.created': CustomerWebhookData;
  'customer.updated': CustomerWebhookData;
  'customer.deleted': CustomerWebhookData;
  
  // Subscription events
  'customer.subscription.created': SubscriptionWebhookData;
  'customer.subscription.updated': SubscriptionWebhookData;
  'customer.subscription.deleted': SubscriptionWebhookData;
  'customer.subscription.paused': SubscriptionWebhookData;
  'customer.subscription.resumed': SubscriptionWebhookData;
  'customer.subscription.trial_will_end': SubscriptionWebhookData;
  
  // Invoice events
  'invoice.created': InvoiceWebhookData;
  'invoice.finalized': InvoiceWebhookData;
  'invoice.payment_succeeded': InvoiceWebhookData;
  'invoice.payment_failed': InvoiceWebhookData;
  'invoice.payment_action_required': InvoiceWebhookData;
  
  // Refund events
  'charge.refunded': Stripe.Charge;
  'charge.refund.updated': Stripe.Refund;
  
  // Connect events
  'account.updated': Stripe.Account;
  'account.application.authorized': Stripe.Account;
  'account.application.deauthorized': Stripe.Account;
  
  // Payout events (for Connect)
  'payout.created': Stripe.Payout;
  'payout.updated': Stripe.Payout;
  'payout.paid': Stripe.Payout;
  'payout.failed': Stripe.Payout;
}

// Helper type to extract event data
export type StripeEventData<T extends keyof StripeWebhookEventMap> = StripeWebhookEventMap[T];

// Extended types for our application

/**
 * Platform fee configuration
 */
export interface StripePlatformFee {
  readonly percentage: number; // As decimal (0.10 = 10%)
  readonly fixed: number; // In cents
  readonly guestSurcharge: number; // Additional percentage for guests
}

/**
 * Payout calculation
 */
export interface StripePayoutCalculation {
  readonly baseAmount: number; // Original service price in cents
  readonly platformFee: number; // Platform's cut in cents
  readonly providerPayout: number; // Provider receives in cents
  readonly customerTotal: number; // Customer pays in cents (includes surcharge if guest)
  readonly isGuest: boolean;
}

/**
 * Connect account status
 */
export type StripeConnectStatus = 
  | 'pending'
  | 'active'
  | 'restricted'
  | 'suspended';

/**
 * Stripe metadata types for our entities
 */
export interface BookingMetadata {
  bookingId: string;
  providerId: string;
  customerId?: string;
  serviceId: string;
  isGuest: 'true' | 'false';
  platformFee: string;
  providerPayout: string;
}

export interface SubscriptionMetadata {
  userId: string;
  planId: string;
  previousPlanId?: string;
  couponCode?: string;
}

export interface RefundMetadata {
  bookingId: string;
  reason: string;
  initiatedBy: 'customer' | 'provider' | 'platform';
}

// Type guards for Stripe events

export function isPaymentIntentEvent(
  event: Stripe.Event
): event is Stripe.Event & { data: { object: Stripe.PaymentIntent } } {
  return event.type.startsWith('payment_intent.');
}

export function isSubscriptionEvent(
  event: Stripe.Event
): event is Stripe.Event & { data: { object: Stripe.Subscription } } {
  return event.type.startsWith('customer.subscription.');
}

export function isInvoiceEvent(
  event: Stripe.Event
): event is Stripe.Event & { data: { object: Stripe.Invoice } } {
  return event.type.startsWith('invoice.');
}

export function isCustomerEvent(
  event: Stripe.Event
): event is Stripe.Event & { data: { object: Stripe.Customer } } {
  return event.type.startsWith('customer.') && !event.type.startsWith('customer.subscription.');
}

// Utility functions for Stripe amounts

/**
 * Convert dollars to Stripe amount (cents)
 */
export function toStripeAmount(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert Stripe amount (cents) to dollars
 */
export function fromStripeAmount(cents: number): number {
  return cents / 100;
}

/**
 * Format Stripe amount for display
 */
export function formatStripeAmount(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(fromStripeAmount(cents));
}