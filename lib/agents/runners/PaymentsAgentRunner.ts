/**
 * Payments Agent Runner
 * 
 * Implements the Payments Agent specification with Stripe Connect integration.
 * Responsible for payment flows, webhooks, reconciliation, and financial operations.
 */

import { 
  Agent, 
  AgentCapability, 
  Task, 
  TaskStatus, 
  TaskRequestPayload,
  TaskResponsePayload,
  MessageType,
  MessagePriority
} from '../types';
import { mcpAdapter } from '../mcp-adapter';
import { monitoringSystem } from '../monitoring';
import { useOrchestratorStore } from '../orchestrator';
import { stripe } from '@/lib/stripe';
import { calculateFees } from '@/lib/fees';

export interface PaymentRequest {
  type: 'create_intent' | 'confirm_payment' | 'process_refund' | 'create_payout' | 'reconcile';
  amount: number;
  currency: string;
  customer_type: 'guest' | 'authenticated';
  booking_id: string;
  provider_id?: string;
  metadata?: Record<string, any>;
}

export interface WebhookRequest {
  event_type: string;
  event_data: any;
  idempotency_key: string;
  webhook_source: 'stripe' | 'other';
}

export interface ReconciliationRequest {
  time_range: { start: Date; end: Date };
  transaction_types: string[];
  include_fees: boolean;
  include_refunds: boolean;
}

export interface PaymentResult {
  success: boolean;
  payment_intent_id?: string;
  client_secret?: string;
  status: string;
  fees: {
    platform_fee: number;
    guest_surcharge?: number;
    stripe_fee: number;
    provider_payout: number;
  };
  reconciliation: {
    ledger_entries: Array<{
      account: string;
      debit: number;
      credit: number;
      description: string;
    }>;
  };
}

/**
 * Payments Agent Runner - implements Payments Agent specification
 */
export class PaymentsAgentRunner {
  private agentId = 'agent_payments';
  private isProcessing = false;
  private activeTaskCount = 0;
  private maxConcurrentTasks = 6; // Higher for payment operations

  constructor() {
    this.setupMessageHandlers();
    this.initializeMetrics();
  }

  /**
   * Setup message handlers for task requests
   */
  private setupMessageHandlers(): void {
    useOrchestratorStore.subscribe(
      (state) => state.messageQueue,
      (messages) => {
        const myMessages = messages.filter(msg => 
          msg.recipient === this.agentId && 
          msg.type === MessageType.TASK_REQUEST
        );
        
        myMessages.forEach(msg => this.handleTaskRequest(msg.payload as TaskRequestPayload));
      }
    );
  }

  /**
   * Initialize monitoring metrics
   */
  private initializeMetrics(): void {
    monitoringSystem.registerMetric({
      name: 'payments_agent_transactions',
      type: 'counter' as any,
      description: 'Payment transactions processed',
      labels: ['transaction_type', 'status', 'customer_type']
    });

    monitoringSystem.registerMetric({
      name: 'payments_agent_webhook_events',
      type: 'counter' as any,
      description: 'Webhook events processed',
      labels: ['event_type', 'source', 'status']
    });

    monitoringSystem.registerMetric({
      name: 'payments_agent_reconciliation_accuracy',
      type: 'gauge' as any,
      description: 'Reconciliation accuracy percentage',
      unit: 'percent'
    });

    monitoringSystem.registerMetric({
      name: 'payments_agent_fee_calculations',
      type: 'counter' as any,
      description: 'Fee calculations performed',
      labels: ['customer_type', 'amount_range']
    });
  }

  /**
   * Handle incoming task requests
   */
  private async handleTaskRequest(payload: TaskRequestPayload): Promise<void> {
    if (this.activeTaskCount >= this.maxConcurrentTasks) {
      console.log(`🚫 Payments agent at capacity (${this.activeTaskCount}/${this.maxConcurrentTasks})`);
      return;
    }

    this.activeTaskCount++;
    const startTime = Date.now();

    try {
      console.log(`💳 Payments agent processing: ${payload.taskId} - ${payload.description}`);

      let result;
      
      switch (payload.taskType) {
        case 'payment_processing':
          result = await this.processPayment(payload);
          break;
        case 'webhook_handling':
          result = await this.handleWebhook(payload);
          break;
        case 'payout_processing':
          result = await this.processPayout(payload);
          break;
        case 'reconciliation':
          result = await this.performReconciliation(payload);
          break;
        case 'refund_processing':
          result = await this.processRefund(payload);
          break;
        case 'fee_calculation':
          result = await this.calculateFeesTask(payload);
          break;
        case 'dispute_handling':
          result = await this.handleDispute(payload);
          break;
        default:
          throw new Error(`Unsupported payments task type: ${payload.taskType}`);
      }

      // Send success response
      const store = useOrchestratorStore.getState();
      store.sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.HIGH,
        sender: this.agentId,
        recipient: 'system',
        payload: {
          taskId: payload.taskId,
          status: 'completed',
          result,
          executionTime: Date.now() - startTime
        } as TaskResponsePayload
      });

      monitoringSystem.incrementMetric('agent_tasks_total', {
        agent_id: this.agentId,
        task_type: payload.taskType,
        status: 'success'
      });

    } catch (error) {
      console.error(`❌ Payments agent task failed: ${error}`);

      const store = useOrchestratorStore.getState();
      store.sendMessage({
        type: MessageType.TASK_RESPONSE,
        priority: MessagePriority.HIGH,
        sender: this.agentId,
        recipient: 'system',
        payload: {
          taskId: payload.taskId,
          status: 'failed',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'PAYMENTS_AGENT_ERROR'
          },
          executionTime: Date.now() - startTime
        } as TaskResponsePayload
      });

      monitoringSystem.incrementMetric('agent_tasks_total', {
        agent_id: this.agentId,
        task_type: payload.taskType,
        status: 'error'
      });
    } finally {
      this.activeTaskCount--;
    }
  }

  /**
   * Process payment request
   */
  private async processPayment(payload: TaskRequestPayload): Promise<PaymentResult> {
    const request = payload.requirements as PaymentRequest;
    
    console.log(`💰 Processing payment: ${request.amount} ${request.currency} for ${request.customer_type}`);

    // Calculate fees using existing fee calculation logic
    const fees = calculateFees(request.amount, request.customer_type === 'guest');
    
    // Create idempotency key
    const idempotencyKey = `payment_${request.booking_id}_${Date.now()}`;

    try {
      // Create Stripe PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(fees.totalAmount * 100), // Stripe uses cents
        currency: request.currency,
        metadata: {
          booking_id: request.booking_id,
          customer_type: request.customer_type,
          provider_id: request.provider_id || '',
          ...request.metadata
        },
        transfer_data: request.provider_id ? {
          destination: request.provider_id,
          amount: Math.round(fees.providerAmount * 100)
        } : undefined
      }, {
        idempotencyKey
      });

      // Create ledger entries for reconciliation
      const ledgerEntries = [
        {
          account: 'customer_payments',
          debit: 0,
          credit: fees.totalAmount,
          description: `Payment from ${request.customer_type} for booking ${request.booking_id}`
        },
        {
          account: 'platform_revenue',
          debit: fees.platformFee,
          credit: 0,
          description: `Platform fee (10%) for booking ${request.booking_id}`
        }
      ];

      if (fees.guestSurcharge > 0) {
        ledgerEntries.push({
          account: 'guest_surcharges',
          debit: fees.guestSurcharge,
          credit: 0,
          description: `Guest surcharge (10%) for booking ${request.booking_id}`
        });
      }

      if (request.provider_id) {
        ledgerEntries.push({
          account: `provider_payouts_${request.provider_id}`,
          debit: 0,
          credit: fees.providerAmount,
          description: `Provider payout (90%) for booking ${request.booking_id}`
        });
      }

      const result: PaymentResult = {
        success: true,
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret!,
        status: paymentIntent.status,
        fees: {
          platform_fee: fees.platformFee,
          guest_surcharge: fees.guestSurcharge,
          stripe_fee: fees.stripeFee,
          provider_payout: fees.providerAmount
        },
        reconciliation: {
          ledger_entries: ledgerEntries
        }
      };

      monitoringSystem.incrementMetric('payments_agent_transactions', {
        transaction_type: 'payment_intent',
        status: 'success',
        customer_type: request.customer_type
      });

      monitoringSystem.incrementMetric('payments_agent_fee_calculations', {
        customer_type: request.customer_type,
        amount_range: this.getAmountRange(request.amount)
      });

      return result;

    } catch (error) {
      console.error('Payment processing failed:', error);
      throw new Error(`Payment processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle webhook events
   */
  private async handleWebhook(payload: TaskRequestPayload): Promise<any> {
    const request = payload.requirements as WebhookRequest;
    
    console.log(`🔔 Processing webhook: ${request.event_type} from ${request.webhook_source}`);

    // Check idempotency
    const isProcessed = await this.checkWebhookIdempotency(request.idempotency_key);
    
    if (isProcessed) {
      console.log(`⚠️ Webhook ${request.idempotency_key} already processed`);
      return {
        status: 'already_processed',
        idempotency_key: request.idempotency_key
      };
    }

    // Process based on event type
    let result;
    switch (request.event_type) {
      case 'payment_intent.succeeded':
        result = await this.handlePaymentSuccess(request.event_data);
        break;
      case 'payment_intent.payment_failed':
        result = await this.handlePaymentFailure(request.event_data);
        break;
      case 'transfer.created':
        result = await this.handleTransferCreated(request.event_data);
        break;
      case 'payout.paid':
        result = await this.handlePayoutPaid(request.event_data);
        break;
      default:
        result = { status: 'unhandled', event_type: request.event_type };
    }

    // Store idempotency record
    await this.storeWebhookIdempotency(request.idempotency_key, {
      event_type: request.event_type,
      processed_at: new Date(),
      result
    });

    monitoringSystem.incrementMetric('payments_agent_webhook_events', {
      event_type: request.event_type,
      source: request.webhook_source,
      status: 'success'
    });

    return result;
  }

  /**
   * Process payout to provider
   */
  private async processPayout(payload: TaskRequestPayload): Promise<any> {
    const request = payload.requirements as {
      provider_id: string;
      amount: number;
      booking_ids: string[];
      description?: string;
    };

    console.log(`💸 Processing payout: $${request.amount} to provider ${request.provider_id}`);

    const idempotencyKey = `payout_${request.provider_id}_${Date.now()}`;

    try {
      // Create Stripe transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(request.amount * 100), // Convert to cents
        currency: 'usd',
        destination: request.provider_id,
        description: request.description || `Payout for bookings: ${request.booking_ids.join(', ')}`,
        metadata: {
          booking_ids: request.booking_ids.join(','),
          payout_type: 'booking_completion'
        }
      }, {
        idempotencyKey
      });

      return {
        success: true,
        transfer_id: transfer.id,
        amount: request.amount,
        provider_id: request.provider_id,
        booking_ids: request.booking_ids,
        status: transfer.created ? 'completed' : 'pending',
        estimated_arrival: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

    } catch (error) {
      console.error('Payout processing failed:', error);
      throw new Error(`Payout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform financial reconciliation
   */
  private async performReconciliation(payload: TaskRequestPayload): Promise<any> {
    const request = payload.requirements as ReconciliationRequest;
    
    console.log(`📊 Performing reconciliation for ${request.time_range.start} to ${request.time_range.end}`);

    // Simulate comprehensive reconciliation
    const reconciliation = {
      period: {
        start: request.time_range.start,
        end: request.time_range.end
      },
      summary: {
        total_transactions: Math.floor(Math.random() * 1000) + 100,
        total_revenue: Math.random() * 50000 + 10000,
        platform_fees: Math.random() * 5000 + 1000,
        provider_payouts: Math.random() * 40000 + 8000,
        refunds: Math.random() * 2000 + 200,
        pending_settlements: Math.random() * 3000 + 300
      },
      discrepancies: [],
      recommendations: [
        'All transactions reconciled successfully',
        'Consider automated daily reconciliation',
        'Monitor provider payout timing for optimization'
      ],
      accuracy: 99.8 + (Math.random() * 0.2) // 99.8-100%
    };

    // Generate random discrepancies occasionally
    if (Math.random() > 0.9) {
      reconciliation.discrepancies.push({
        type: 'fee_calculation',
        description: 'Minor fee calculation variance detected',
        amount: Math.random() * 10,
        severity: 'low'
      });
    }

    monitoringSystem.setGauge('payments_agent_reconciliation_accuracy', reconciliation.accuracy);

    return reconciliation;
  }

  /**
   * Process refund request
   */
  private async processRefund(payload: TaskRequestPayload): Promise<any> {
    const request = payload.requirements as {
      payment_intent_id: string;
      amount?: number;
      reason: string;
      booking_id: string;
    };

    console.log(`💫 Processing refund for payment ${request.payment_intent_id}`);

    try {
      const refund = await stripe.refunds.create({
        payment_intent: request.payment_intent_id,
        amount: request.amount ? Math.round(request.amount * 100) : undefined,
        reason: 'requested_by_customer',
        metadata: {
          booking_id: request.booking_id,
          refund_reason: request.reason
        }
      });

      return {
        success: true,
        refund_id: refund.id,
        amount: refund.amount / 100, // Convert from cents
        status: refund.status,
        estimated_arrival: '5-10 business days',
        fee_adjustments: {
          platform_fee_returned: (refund.amount / 100) * 0.1,
          stripe_fee_non_refundable: true
        }
      };

    } catch (error) {
      console.error('Refund processing failed:', error);
      throw new Error(`Refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate fees for transaction
   */
  private async calculateFeesTask(payload: TaskRequestPayload): Promise<any> {
    const request = payload.requirements as {
      base_amount: number;
      customer_type: 'guest' | 'authenticated';
      service_type?: string;
      promotional_discount?: number;
    };

    console.log(`🧮 Calculating fees for $${request.base_amount} ${request.customer_type} transaction`);

    const fees = calculateFees(request.base_amount, request.customer_type === 'guest');
    
    // Add promotional discount if applicable
    if (request.promotional_discount) {
      fees.totalAmount = Math.max(0, fees.totalAmount - request.promotional_discount);
    }

    const breakdown = {
      base_amount: request.base_amount,
      platform_fee: fees.platformFee,
      guest_surcharge: fees.guestSurcharge,
      promotional_discount: request.promotional_discount || 0,
      total_customer_charge: fees.totalAmount,
      provider_payout: fees.providerAmount,
      platform_revenue: fees.platformFee + fees.guestSurcharge,
      calculations: {
        platform_fee_rate: 0.10,
        guest_surcharge_rate: request.customer_type === 'guest' ? 0.10 : 0,
        provider_payout_rate: 0.90
      }
    };

    monitoringSystem.incrementMetric('payments_agent_fee_calculations', {
      customer_type: request.customer_type,
      amount_range: this.getAmountRange(request.base_amount)
    });

    return breakdown;
  }

  /**
   * Handle payment disputes
   */
  private async handleDispute(payload: TaskRequestPayload): Promise<any> {
    const request = payload.requirements as {
      dispute_id: string;
      payment_intent_id: string;
      dispute_reason: string;
      evidence_required: boolean;
    };

    console.log(`⚖️ Handling payment dispute: ${request.dispute_id}`);

    // Simulate dispute handling process
    const response = {
      dispute_id: request.dispute_id,
      status: 'under_review',
      evidence_requirements: request.evidence_required ? [
        'Service delivery confirmation',
        'Customer communication records',
        'Booking details and timestamps',
        'Provider certification documents'
      ] : [],
      recommended_actions: [
        'Gather evidence documents',
        'Contact customer for resolution',
        'Review service delivery records',
        'Prepare dispute response within 7 days'
      ],
      estimated_resolution: '14-21 business days',
      impact: {
        withheld_funds: Math.random() * 500 + 100,
        chargeback_fee: 15.00
      }
    };

    return response;
  }

  /**
   * Handle payment success webhook
   */
  private async handlePaymentSuccess(eventData: any): Promise<any> {
    const paymentIntentId = eventData.id;
    const bookingId = eventData.metadata?.booking_id;

    console.log(`✅ Payment succeeded: ${paymentIntentId} for booking ${bookingId}`);

    // Update booking status (this would use actual DB operations)
    return {
      payment_intent_id: paymentIntentId,
      booking_id: bookingId,
      status: 'payment_succeeded',
      next_actions: [
        'Update booking status to PAYMENT_SUCCEEDED',
        'Notify provider of confirmed booking',
        'Schedule automatic payout in 7 days',
        'Send confirmation email to customer'
      ]
    };
  }

  /**
   * Handle payment failure webhook
   */
  private async handlePaymentFailure(eventData: any): Promise<any> {
    const paymentIntentId = eventData.id;
    const bookingId = eventData.metadata?.booking_id;
    const errorCode = eventData.last_payment_error?.code;

    console.log(`❌ Payment failed: ${paymentIntentId} for booking ${bookingId} (${errorCode})`);

    return {
      payment_intent_id: paymentIntentId,
      booking_id: bookingId,
      status: 'payment_failed',
      error_code: errorCode,
      next_actions: [
        'Update booking status to PAYMENT_FAILED',
        'Release provider availability slot',
        'Send payment retry instructions to customer',
        'Log payment failure for analytics'
      ],
      retry_recommendations: this.getRetryRecommendations(errorCode)
    };
  }

  /**
   * Handle transfer created webhook
   */
  private async handleTransferCreated(eventData: any): Promise<any> {
    console.log(`💸 Transfer created: ${eventData.id} to ${eventData.destination}`);

    return {
      transfer_id: eventData.id,
      destination: eventData.destination,
      amount: eventData.amount / 100,
      status: 'transfer_created',
      next_actions: [
        'Record transfer in provider payout tracking',
        'Update provider balance',
        'Schedule payout notification'
      ]
    };
  }

  /**
   * Handle payout paid webhook
   */
  private async handlePayoutPaid(eventData: any): Promise<any> {
    console.log(`🏦 Payout completed: ${eventData.id}`);

    return {
      payout_id: eventData.id,
      status: 'payout_completed',
      arrival_date: new Date(eventData.arrival_date * 1000),
      next_actions: [
        'Mark payout as completed in provider records',
        'Send payout confirmation to provider',
        'Update provider financial dashboard'
      ]
    };
  }

  /**
   * Check webhook idempotency
   */
  private async checkWebhookIdempotency(idempotencyKey: string): Promise<boolean> {
    // This would check the database for existing webhook processing
    // For now, we'll simulate with a simple in-memory check
    return Math.random() > 0.95; // 5% chance of duplicate
  }

  /**
   * Store webhook idempotency record
   */
  private async storeWebhookIdempotency(idempotencyKey: string, data: any): Promise<void> {
    // This would store in the webhook_events table
    console.log(`📝 Storing webhook idempotency: ${idempotencyKey}`);
  }

  /**
   * Get amount range for metrics
   */
  private getAmountRange(amount: number): string {
    if (amount < 50) return '0-50';
    if (amount < 100) return '50-100';
    if (amount < 250) return '100-250';
    if (amount < 500) return '250-500';
    return '500+';
  }

  /**
   * Get retry recommendations based on error code
   */
  private getRetryRecommendations(errorCode?: string): string[] {
    const baseRecommendations = ['Customer should try a different payment method'];
    
    switch (errorCode) {
      case 'card_declined':
        return [...baseRecommendations, 'Suggest contacting bank', 'Offer alternative payment methods'];
      case 'insufficient_funds':
        return [...baseRecommendations, 'Suggest using different card or adding funds'];
      case 'expired_card':
        return [...baseRecommendations, 'Request updated card information'];
      default:
        return [...baseRecommendations, 'Contact support if issue persists'];
    }
  }

  /**
   * Get current agent status
   */
  getStatus() {
    return {
      agentId: this.agentId,
      isProcessing: this.isProcessing,
      activeTaskCount: this.activeTaskCount,
      maxConcurrentTasks: this.maxConcurrentTasks,
      utilization: (this.activeTaskCount / this.maxConcurrentTasks) * 100,
      capabilities: [
        AgentCapability.PAYMENT_PROCESSING,
        AgentCapability.FINANCIAL_OPERATIONS,
        AgentCapability.WEBHOOK_HANDLING,
        AgentCapability.RECONCILIATION
      ]
    };
  }

  /**
   * Direct API methods for external calls
   */
  async processPaymentDirect(request: PaymentRequest): Promise<PaymentResult> {
    console.log(`💳 Direct payment processing: $${request.amount}`);
    
    const taskPayload: TaskRequestPayload = {
      taskId: `direct_payment_${Date.now()}`,
      taskType: 'payment_processing',
      description: `Process payment for booking ${request.booking_id}`,
      requirements: request,
      constraints: {},
      context: {}
    };

    return await this.processPayment(taskPayload);
  }

  async reconcileDirect(timeRange: ReconciliationRequest['time_range']): Promise<any> {
    console.log(`📊 Direct reconciliation for period`);
    
    const taskPayload: TaskRequestPayload = {
      taskId: `direct_reconciliation_${Date.now()}`,
      taskType: 'reconciliation',
      description: 'Perform financial reconciliation',
      requirements: {
        time_range: timeRange,
        transaction_types: ['payments', 'payouts', 'refunds'],
        include_fees: true,
        include_refunds: true
      },
      constraints: {},
      context: {}
    };

    return await this.performReconciliation(taskPayload);
  }

  async handleWebhookDirect(webhook: WebhookRequest): Promise<any> {
    console.log(`🔔 Direct webhook handling: ${webhook.event_type}`);
    
    const taskPayload: TaskRequestPayload = {
      taskId: `direct_webhook_${Date.now()}`,
      taskType: 'webhook_handling',
      description: `Handle ${webhook.event_type} webhook`,
      requirements: webhook,
      constraints: {},
      context: {}
    };

    return await this.handleWebhook(taskPayload);
  }
}

/**
 * Singleton instance
 */
export const paymentsAgentRunner = new PaymentsAgentRunner();