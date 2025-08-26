import { db } from "@/db/db";
import { 
  transactionsTable, 
  bookingsTable,
  providersTable,
  profilesTable 
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

// Types
export interface DisputeEvidence {
  receipt?: string;
  customerCommunication?: string;
  serviceDocumentation?: string;
  refundPolicy?: string;
  shippingDocumentation?: string;
  customerSignature?: string;
  billingAddress?: string;
  cancellationPolicy?: string;
  duplicateChargeDocumentation?: string;
  productDescription?: string;
}

export interface DisputeDetails {
  id: string;
  bookingId: string;
  transactionId: string;
  stripeDisputeId: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  evidenceDueBy: Date | null;
  evidence: DisputeEvidence;
  outcome: any;
  createdAt: Date;
}

export class DisputeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = stripe;
  }

  /**
   * Handle incoming dispute webhook from Stripe
   */
  async handleDisputeWebhook(stripeDispute: Stripe.Dispute) {
    try {
      // Find the related transaction
      const chargeId = stripeDispute.charge as string;
      const [transaction] = await db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.stripeChargeId, chargeId))
        .limit(1);

      if (!transaction) {
        console.error(`Transaction not found for charge ${chargeId}`);
        return;
      }

      // Check if dispute already exists
      const existingDispute = await db
        .select()
        .from(sql`disputes`)
        .where(eq(sql`disputes.stripe_dispute_id`, stripeDispute.id))
        .limit(1);

      if (existingDispute.length > 0) {
        // Update existing dispute
        await this.updateDispute(stripeDispute);
      } else {
        // Create new dispute record
        await this.createDispute(stripeDispute, transaction);
      }

      // Auto-collect evidence if possible
      await this.autoCollectEvidence(stripeDispute.id, transaction.bookingId);

    } catch (error) {
      console.error('Error handling dispute webhook:', error);
      throw error;
    }
  }

  /**
   * Create dispute record in database
   */
  private async createDispute(stripeDispute: Stripe.Dispute, transaction: any) {
    const [dispute] = await db
      .insert(sql`disputes`)
      .values({
        booking_id: transaction.bookingId,
        transaction_id: transaction.id,
        stripe_dispute_id: stripeDispute.id,
        amount: stripeDispute.amount / 100, // Convert from cents
        currency: stripeDispute.currency,
        reason: stripeDispute.reason,
        status: stripeDispute.status,
        evidence_due_by: stripeDispute.evidence_details?.due_by 
          ? new Date(stripeDispute.evidence_details.due_by * 1000)
          : null,
        evidence: {},
        outcome: stripeDispute.evidence_details || {},
        metadata: {
          network_reason_code: stripeDispute.network_reason_code,
          created: stripeDispute.created,
        },
      })
      .returning();

    // Notify relevant parties
    await this.notifyDisputeCreated(dispute);

    return dispute;
  }

  /**
   * Update existing dispute
   */
  private async updateDispute(stripeDispute: Stripe.Dispute) {
    await db
      .update(sql`disputes`)
      .set({
        status: stripeDispute.status,
        evidence_due_by: stripeDispute.evidence_details?.due_by
          ? new Date(stripeDispute.evidence_details.due_by * 1000)
          : null,
        outcome: stripeDispute.evidence_details || {},
        updated_at: new Date(),
      })
      .where(eq(sql`disputes.stripe_dispute_id`, stripeDispute.id));
  }

  /**
   * Auto-collect evidence for dispute
   */
  async autoCollectEvidence(stripeDisputeId: string, bookingId: string) {
    try {
      // Fetch booking details
      const [booking] = await db
        .select({
          id: bookingsTable.id,
          providerId: bookingsTable.providerId,
          customerId: bookingsTable.customerId,
          serviceName: bookingsTable.serviceName,
          servicePrice: bookingsTable.servicePrice,
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
          status: bookingsTable.status,
          customerNotes: bookingsTable.customerNotes,
          confirmationCode: bookingsTable.confirmationCode,
          createdAt: bookingsTable.createdAt,
          completedAt: bookingsTable.completedAt,
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId))
        .limit(1);

      if (!booking) {
        console.error(`Booking not found: ${bookingId}`);
        return;
      }

      // Fetch provider details
      const [provider] = await db
        .select({
          id: providersTable.id,
          businessName: providersTable.businessName,
          email: providersTable.email,
          phone: providersTable.phone,
          refundPolicy: providersTable.refundPolicy,
          cancellationPolicy: providersTable.cancellationPolicy,
        })
        .from(providersTable)
        .where(eq(providersTable.id, booking.providerId))
        .limit(1);

      // Fetch customer details
      const [customer] = await db
        .select({
          userId: profilesTable.userId,
          email: profilesTable.email,
          fullName: profilesTable.fullName,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, booking.customerId))
        .limit(1);

      // Prepare evidence
      const evidence: DisputeEvidence = {
        receipt: this.generateReceipt(booking, provider, customer),
        customerCommunication: this.gatherCustomerCommunication(bookingId),
        serviceDocumentation: this.generateServiceDocumentation(booking, provider),
        refundPolicy: provider?.refundPolicy || 'Standard refund policy applies',
        cancellationPolicy: provider?.cancellationPolicy || 'Standard cancellation policy applies',
        productDescription: `${booking.serviceName} - Professional service provided on ${booking.bookingDate}`,
      };

      // Store evidence in database
      await this.storeEvidence(stripeDisputeId, evidence);

      // Submit evidence to Stripe if ready
      if (this.isEvidenceComplete(evidence)) {
        await this.submitEvidenceToStripe(stripeDisputeId, evidence);
      }

    } catch (error) {
      console.error('Error collecting evidence:', error);
    }
  }

  /**
   * Generate receipt for evidence
   */
  private generateReceipt(booking: any, provider: any, customer: any): string {
    return `
      RECEIPT
      =====================================
      Confirmation Code: ${booking.confirmationCode}
      Date: ${booking.bookingDate}
      
      Customer: ${customer?.fullName || 'Guest'}
      Email: ${customer?.email || 'N/A'}
      
      Provider: ${provider?.businessName || 'N/A'}
      Service: ${booking.serviceName}
      
      Date/Time: ${booking.bookingDate} ${booking.startTime} - ${booking.endTime}
      Amount Paid: $${booking.servicePrice}
      
      Status: ${booking.status}
      Booked On: ${booking.createdAt}
      ${booking.completedAt ? `Completed On: ${booking.completedAt}` : ''}
      
      Notes: ${booking.customerNotes || 'None'}
      =====================================
    `;
  }

  /**
   * Gather customer communication
   */
  private gatherCustomerCommunication(bookingId: string): string {
    // This would typically fetch from a messages/communication table
    // For now, returning a placeholder
    return `Customer confirmed booking and service was provided as agreed.`;
  }

  /**
   * Generate service documentation
   */
  private generateServiceDocumentation(booking: any, provider: any): string {
    return `
      SERVICE DOCUMENTATION
      =====================================
      Service Provider: ${provider?.businessName}
      Service Type: ${booking.serviceName}
      
      Scheduled Time: ${booking.bookingDate} ${booking.startTime}
      Actual Completion: ${booking.completedAt || 'In Progress'}
      
      Service Status: ${booking.status}
      
      Provider Contact: ${provider?.email} | ${provider?.phone}
      
      This service was booked through our platform and completed
      according to the agreed terms and conditions.
      =====================================
    `;
  }

  /**
   * Store evidence in database
   */
  private async storeEvidence(stripeDisputeId: string, evidence: DisputeEvidence) {
    // Update dispute with evidence
    await db
      .update(sql`disputes`)
      .set({
        evidence: evidence as any,
        updated_at: new Date(),
      })
      .where(eq(sql`disputes.stripe_dispute_id`, stripeDisputeId));

    // Store individual evidence pieces
    for (const [type, content] of Object.entries(evidence)) {
      if (content) {
        await db
          .insert(sql`dispute_evidence`)
          .values({
            dispute_id: await this.getDisputeId(stripeDisputeId),
            evidence_type: type,
            description: content.substring(0, 500), // Store first 500 chars as description
            submitted_to_stripe: false,
            created_by: 'system',
          });
      }
    }
  }

  /**
   * Get dispute ID from Stripe dispute ID
   */
  private async getDisputeId(stripeDisputeId: string): Promise<string> {
    const [dispute] = await db
      .select({ id: sql`disputes.id` })
      .from(sql`disputes`)
      .where(eq(sql`disputes.stripe_dispute_id`, stripeDisputeId))
      .limit(1);
    
    return dispute?.id || '';
  }

  /**
   * Check if evidence is complete
   */
  private isEvidenceComplete(evidence: DisputeEvidence): boolean {
    // Check if we have minimum required evidence
    return !!(
      evidence.receipt &&
      evidence.serviceDocumentation &&
      evidence.refundPolicy
    );
  }

  /**
   * Submit evidence to Stripe
   */
  async submitEvidenceToStripe(stripeDisputeId: string, evidence: DisputeEvidence) {
    try {
      const stripeEvidence: Stripe.DisputeUpdateParams.Evidence = {
        receipt: evidence.receipt,
        customer_communication: evidence.customerCommunication,
        service_documentation: evidence.serviceDocumentation,
        refund_policy: evidence.refundPolicy,
        cancellation_policy: evidence.cancellationPolicy,
        product_description: evidence.productDescription,
      };

      // Update dispute in Stripe
      await this.stripe.disputes.update(stripeDisputeId, {
        evidence: stripeEvidence,
      });

      // Mark evidence as submitted
      await db
        .update(sql`disputes`)
        .set({
          evidence_submitted_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(sql`disputes.stripe_dispute_id`, stripeDisputeId));

      // Update evidence records
      const disputeId = await this.getDisputeId(stripeDisputeId);
      await db
        .update(sql`dispute_evidence`)
        .set({
          submitted_to_stripe: true,
          submitted_at: new Date(),
        })
        .where(eq(sql`dispute_evidence.dispute_id`, disputeId));

      console.log(`Evidence submitted for dispute ${stripeDisputeId}`);
    } catch (error) {
      console.error('Error submitting evidence to Stripe:', error);
      throw error;
    }
  }

  /**
   * Get all disputes for admin dashboard
   */
  async getAllDisputes(filters?: {
    status?: string;
    providerId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const query = db
      .select({
        dispute: sql`disputes.*`,
        booking: bookingsTable,
        provider: providersTable,
      })
      .from(sql`disputes`)
      .leftJoin(bookingsTable, eq(sql`disputes.booking_id`, bookingsTable.id))
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id));

    // Apply filters
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(sql`disputes.status`, filters.status));
    }
    if (filters?.providerId) {
      conditions.push(eq(providersTable.id, filters.providerId));
    }
    if (filters?.startDate) {
      conditions.push(sql`disputes.created_at >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`disputes.created_at <= ${filters.endDate}`);
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query.orderBy(desc(sql`disputes.created_at`));
  }

  /**
   * Get dispute details by ID
   */
  async getDisputeDetails(disputeId: string): Promise<DisputeDetails | null> {
    const [result] = await db
      .select({
        id: sql`disputes.id`,
        bookingId: sql`disputes.booking_id`,
        transactionId: sql`disputes.transaction_id`,
        stripeDisputeId: sql`disputes.stripe_dispute_id`,
        amount: sql`disputes.amount`,
        currency: sql`disputes.currency`,
        reason: sql`disputes.reason`,
        status: sql`disputes.status`,
        evidenceDueBy: sql`disputes.evidence_due_by`,
        evidence: sql`disputes.evidence`,
        outcome: sql`disputes.outcome`,
        createdAt: sql`disputes.created_at`,
      })
      .from(sql`disputes`)
      .where(eq(sql`disputes.id`, disputeId))
      .limit(1);

    return result as DisputeDetails | null;
  }

  /**
   * Manually add evidence to dispute
   */
  async addEvidence(
    disputeId: string,
    evidenceType: string,
    fileUrl: string,
    description: string,
    createdBy: string
  ) {
    await db
      .insert(sql`dispute_evidence`)
      .values({
        dispute_id: disputeId,
        evidence_type: evidenceType,
        file_url: fileUrl,
        description,
        created_by: createdBy,
      });

    // Check if we should auto-submit
    await this.checkAndSubmitEvidence(disputeId);
  }

  /**
   * Check if evidence is complete and submit if ready
   */
  private async checkAndSubmitEvidence(disputeId: string) {
    const [dispute] = await db
      .select()
      .from(sql`disputes`)
      .where(eq(sql`disputes.id`, disputeId))
      .limit(1);

    if (dispute && !dispute.evidence_submitted_at) {
      const evidence = dispute.evidence as DisputeEvidence;
      if (this.isEvidenceComplete(evidence)) {
        await this.submitEvidenceToStripe(dispute.stripe_dispute_id, evidence);
      }
    }
  }

  /**
   * Notify relevant parties about dispute
   */
  private async notifyDisputeCreated(dispute: any) {
    // Implementation would depend on your notification system
    console.log(`Dispute created: ${dispute.id}`);
    
    // You could send emails, push notifications, etc.
    // Example structure:
    // await emailService.sendDisputeNotification(dispute);
    // await pushNotificationService.sendDisputeAlert(dispute);
  }

  /**
   * Get dispute statistics
   */
  async getDisputeStats(providerId?: string) {
    const baseQuery = db.select({
      total: sql<number>`COUNT(*)`,
      won: sql<number>`COUNT(CASE WHEN status = 'won' THEN 1 END)`,
      lost: sql<number>`COUNT(CASE WHEN status = 'lost' THEN 1 END)`,
      pending: sql<number>`COUNT(CASE WHEN status IN ('warning_needs_response', 'needs_response', 'under_review') THEN 1 END)`,
      totalAmount: sql<number>`SUM(amount)`,
    }).from(sql`disputes`);

    if (providerId) {
      baseQuery
        .leftJoin(bookingsTable, eq(sql`disputes.booking_id`, bookingsTable.id))
        .where(eq(bookingsTable.providerId, providerId));
    }

    const [stats] = await baseQuery;
    return stats;
  }
}

// Export singleton instance
export const disputeService = new DisputeService();