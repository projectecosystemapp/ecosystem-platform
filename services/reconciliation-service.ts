import { db } from "@/db/db";
import { 
  transactionsTable, 
  bookingsTable,
  payoutSchedulesTable 
} from "@/db/schema";
import { eq, and, gte, lte, sql, inArray, isNull } from "drizzle-orm";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

// Types
interface ReconciliationResult {
  runId: string;
  date: Date;
  matched: number;
  unmatched: number;
  discrepancies: DiscrepancyItem[];
  totalReconciled: number;
  errors: string[];
}

interface DiscrepancyItem {
  transactionId?: string;
  stripeId: string;
  type: 'charge' | 'transfer' | 'payout' | 'refund';
  databaseAmount: number;
  stripeAmount: number;
  difference: number;
  currency: string;
  status: 'missing_in_db' | 'missing_in_stripe' | 'amount_mismatch';
}

interface StripeTransaction {
  id: string;
  amount: number;
  currency: string;
  type: 'charge' | 'transfer' | 'payout' | 'refund';
  metadata?: Record<string, any>;
}

// Main reconciliation service
export class ReconciliationService {
  private stripe: Stripe;
  
  constructor() {
    this.stripe = stripe;
  }

  /**
   * Run daily reconciliation
   */
  async runDailyReconciliation(date?: Date): Promise<ReconciliationResult> {
    const reconciliationDate = date || new Date();
    const startOfDay = new Date(reconciliationDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reconciliationDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Starting reconciliation for ${startOfDay.toISOString()}`);

    // Create reconciliation run record
    const [runRecord] = await db
      .insert(sql`reconciliation_runs`)
      .values({
        run_date: startOfDay,
        run_type: 'daily',
        status: 'running',
        start_time: new Date(),
      })
      .returning();

    const runId = runRecord.id;
    const discrepancies: DiscrepancyItem[] = [];
    const errors: string[] = [];

    try {
      // 1. Fetch all database transactions for the day
      const dbTransactions = await this.fetchDatabaseTransactions(startOfDay, endOfDay);
      
      // 2. Fetch all Stripe transactions for the day
      const stripeTransactions = await this.fetchStripeTransactions(
        Math.floor(startOfDay.getTime() / 1000),
        Math.floor(endOfDay.getTime() / 1000)
      );

      // 3. Compare and reconcile
      const reconciliationResult = await this.compareTransactions(
        dbTransactions,
        stripeTransactions,
        runId
      );

      // 4. Process discrepancies
      for (const discrepancy of reconciliationResult.discrepancies) {
        await this.recordDiscrepancy(runId, discrepancy);
        discrepancies.push(discrepancy);
      }

      // 5. Update reconciliation run with results
      await db
        .update(sql`reconciliation_runs`)
        .set({
          status: 'completed',
          end_time: new Date(),
          total_transactions: dbTransactions.length + stripeTransactions.length,
          matched_transactions: reconciliationResult.matched,
          unmatched_transactions: reconciliationResult.unmatched,
          discrepancies_found: discrepancies.length,
          total_amount_reconciled: reconciliationResult.totalAmount,
        })
        .where(eq(sql`reconciliation_runs.id`, runId));

      // 6. Generate alerts for critical discrepancies
      await this.generateAlerts(discrepancies);

      return {
        runId,
        date: reconciliationDate,
        matched: reconciliationResult.matched,
        unmatched: reconciliationResult.unmatched,
        discrepancies,
        totalReconciled: reconciliationResult.totalAmount,
        errors,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      // Mark run as failed
      await db
        .update(sql`reconciliation_runs`)
        .set({
          status: 'failed',
          end_time: new Date(),
          error_message: errorMessage,
        })
        .where(eq(sql`reconciliation_runs.id`, runId));

      throw error;
    }
  }

  /**
   * Fetch database transactions
   */
  private async fetchDatabaseTransactions(startDate: Date, endDate: Date) {
    const transactions = await db
      .select({
        id: transactionsTable.id,
        stripeChargeId: transactionsTable.stripeChargeId,
        stripeTransferId: transactionsTable.stripeTransferId,
        stripeRefundId: transactionsTable.stripeRefundId,
        amount: transactionsTable.amount,
        platformFee: transactionsTable.platformFee,
        providerPayout: transactionsTable.providerPayout,
        refundAmount: transactionsTable.refundAmount,
        currency: sql<string>`COALESCE(${transactionsTable.currency}, 'USD')`,
        status: transactionsTable.status,
        createdAt: transactionsTable.createdAt,
      })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.createdAt, startDate),
          lte(transactionsTable.createdAt, endDate)
        )
      );

    return transactions;
  }

  /**
   * Fetch Stripe transactions
   */
  private async fetchStripeTransactions(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<StripeTransaction[]> {
    const transactions: StripeTransaction[] = [];

    // Fetch charges
    const charges = await this.stripe.charges.list({
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      limit: 100, // Paginate if needed
    });

    for (const charge of charges.data) {
      transactions.push({
        id: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        type: 'charge',
        metadata: charge.metadata,
      });
    }

    // Fetch transfers
    const transfers = await this.stripe.transfers.list({
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      limit: 100,
    });

    for (const transfer of transfers.data) {
      transactions.push({
        id: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        type: 'transfer',
        metadata: transfer.metadata,
      });
    }

    // Fetch payouts
    const payouts = await this.stripe.payouts.list({
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      limit: 100,
    });

    for (const payout of payouts.data) {
      transactions.push({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        type: 'payout',
        metadata: payout.metadata,
      });
    }

    // Fetch refunds
    const refunds = await this.stripe.refunds.list({
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      limit: 100,
    });

    for (const refund of refunds.data) {
      transactions.push({
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        type: 'refund',
        metadata: refund.metadata,
      });
    }

    return transactions;
  }

  /**
   * Compare database and Stripe transactions
   */
  private async compareTransactions(
    dbTransactions: any[],
    stripeTransactions: StripeTransaction[],
    runId: string
  ) {
    const matched = new Set<string>();
    const discrepancies: DiscrepancyItem[] = [];
    let totalAmount = 0;

    // Create lookup maps
    const dbChargeMap = new Map(
      dbTransactions
        .filter(t => t.stripeChargeId)
        .map(t => [t.stripeChargeId, t])
    );
    const dbTransferMap = new Map(
      dbTransactions
        .filter(t => t.stripeTransferId)
        .map(t => [t.stripeTransferId, t])
    );
    const dbRefundMap = new Map(
      dbTransactions
        .filter(t => t.stripeRefundId)
        .map(t => [t.stripeRefundId, t])
    );

    // Check each Stripe transaction
    for (const stripeTx of stripeTransactions) {
      let dbTx: any = null;
      let dbAmount = 0;

      switch (stripeTx.type) {
        case 'charge':
          dbTx = dbChargeMap.get(stripeTx.id);
          dbAmount = dbTx ? parseFloat(dbTx.amount) * 100 : 0; // Convert to cents
          break;
        case 'transfer':
          dbTx = dbTransferMap.get(stripeTx.id);
          dbAmount = dbTx ? parseFloat(dbTx.providerPayout) * 100 : 0;
          break;
        case 'refund':
          dbTx = dbRefundMap.get(stripeTx.id);
          dbAmount = dbTx ? parseFloat(dbTx.refundAmount || 0) * 100 : 0;
          break;
      }

      if (!dbTx) {
        // Missing in database
        discrepancies.push({
          stripeId: stripeTx.id,
          type: stripeTx.type,
          databaseAmount: 0,
          stripeAmount: stripeTx.amount,
          difference: stripeTx.amount,
          currency: stripeTx.currency,
          status: 'missing_in_db',
        });
      } else {
        matched.add(dbTx.id);
        
        // Check amounts match
        if (Math.abs(dbAmount - stripeTx.amount) > 1) { // Allow 1 cent difference for rounding
          discrepancies.push({
            transactionId: dbTx.id,
            stripeId: stripeTx.id,
            type: stripeTx.type,
            databaseAmount: dbAmount,
            stripeAmount: stripeTx.amount,
            difference: Math.abs(dbAmount - stripeTx.amount),
            currency: stripeTx.currency,
            status: 'amount_mismatch',
          });
        } else {
          totalAmount += stripeTx.amount / 100; // Convert back to dollars
        }
      }
    }

    // Check for database transactions not in Stripe
    for (const dbTx of dbTransactions) {
      if (!matched.has(dbTx.id) && dbTx.status === 'completed') {
        const stripeId = dbTx.stripeChargeId || dbTx.stripeTransferId || dbTx.stripeRefundId;
        if (stripeId) {
          discrepancies.push({
            transactionId: dbTx.id,
            stripeId: stripeId,
            type: dbTx.stripeChargeId ? 'charge' : dbTx.stripeTransferId ? 'transfer' : 'refund',
            databaseAmount: parseFloat(dbTx.amount) * 100,
            stripeAmount: 0,
            difference: parseFloat(dbTx.amount) * 100,
            currency: dbTx.currency,
            status: 'missing_in_stripe',
          });
        }
      }
    }

    return {
      matched: matched.size,
      unmatched: discrepancies.length,
      discrepancies,
      totalAmount,
    };
  }

  /**
   * Record a discrepancy
   */
  private async recordDiscrepancy(runId: string, discrepancy: DiscrepancyItem) {
    await db.insert(sql`reconciliation_items`).values({
      reconciliation_run_id: runId,
      transaction_id: discrepancy.transactionId || null,
      stripe_charge_id: discrepancy.type === 'charge' ? discrepancy.stripeId : null,
      stripe_transfer_id: discrepancy.type === 'transfer' ? discrepancy.stripeId : null,
      item_type: discrepancy.type,
      database_amount: discrepancy.databaseAmount / 100, // Convert to dollars
      stripe_amount: discrepancy.stripeAmount / 100,
      discrepancy_amount: discrepancy.difference / 100,
      currency: discrepancy.currency,
      status: discrepancy.status,
      resolution_status: 'pending',
    });
  }

  /**
   * Generate alerts for critical discrepancies
   */
  private async generateAlerts(discrepancies: DiscrepancyItem[]) {
    const criticalDiscrepancies = discrepancies.filter(
      d => d.difference > 10000 || // Over $100
           d.status === 'missing_in_db' // Missing transactions
    );

    if (criticalDiscrepancies.length > 0) {
      // Send notifications (implement based on your notification system)
      console.error(`CRITICAL: ${criticalDiscrepancies.length} critical discrepancies found`);
      
      // You can implement email, Slack, or other notification methods here
      for (const discrepancy of criticalDiscrepancies) {
        console.error(`Discrepancy: ${JSON.stringify(discrepancy)}`);
      }
    }
  }

  /**
   * Get reconciliation report
   */
  async getReconciliationReport(runId: string) {
    const run = await db
      .select()
      .from(sql`reconciliation_runs`)
      .where(eq(sql`reconciliation_runs.id`, runId))
      .limit(1);

    if (!run[0]) {
      throw new Error('Reconciliation run not found');
    }

    const items = await db
      .select()
      .from(sql`reconciliation_items`)
      .where(eq(sql`reconciliation_items.reconciliation_run_id`, runId));

    return {
      run: run[0],
      items,
      summary: {
        totalItems: items.length,
        matched: items.filter(i => i.status === 'matched').length,
        unmatched: items.filter(i => i.status !== 'matched').length,
        pending: items.filter(i => i.resolution_status === 'pending').length,
        resolved: items.filter(i => i.resolution_status === 'resolved').length,
      },
    };
  }

  /**
   * Resolve a discrepancy
   */
  async resolveDiscrepancy(
    itemId: string,
    resolution: {
      status: 'resolved' | 'escalated' | 'ignored';
      notes: string;
      resolvedBy: string;
    }
  ) {
    await db
      .update(sql`reconciliation_items`)
      .set({
        resolution_status: resolution.status,
        resolution_notes: resolution.notes,
        resolved_by: resolution.resolvedBy,
        resolved_at: new Date(),
      })
      .where(eq(sql`reconciliation_items.id`, itemId));
  }
}

// Export singleton instance
export const reconciliationService = new ReconciliationService();