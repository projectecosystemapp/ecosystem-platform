/**
 * Receipt Generation API
 * 
 * Generates downloadable receipts for booking transactions
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";

export const GET = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest, { params }: { params: { bookingId: string } }) => {
    try {
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const { bookingId } = params;

      // Get booking with transaction details
      const [record] = await db
        .select({
          booking: bookingsTable,
          transaction: transactionsTable,
          customer: profilesTable,
        })
        .from(bookingsTable)
        .leftJoin(transactionsTable, eq(bookingsTable.id, transactionsTable.bookingId))
        .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.id))
        .where(eq(bookingsTable.id, bookingId))
        .limit(1);

      if (!record) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      // Verify ownership
      const isOwner = record.customer?.userId === userId;
      
      if (!isOwner) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Generate receipt HTML
      const receiptHtml = generateReceiptHtml({
        booking: record.booking,
        transaction: record.transaction,
        customer: record.customer,
      });

      // For now, return HTML. In production, you'd want to use a PDF generator
      // like Puppeteer or jsPDF to create actual PDF receipts
      
      return new NextResponse(receiptHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="receipt-${record.booking.confirmationCode}.html"`,
        },
      });

    } catch (error) {
      console.error("Error generating receipt:", error);
      return NextResponse.json(
        { error: "Failed to generate receipt" },
        { status: 500 }
      );
    }
  }
);

function generateReceiptHtml({ booking, transaction, customer }: {
  booking: any;
  transaction: any;
  customer: any;
}): string {
  const bookingDate = new Date(booking.bookingDate).toLocaleDateString();
  const paymentDate = new Date(transaction?.createdAt || booking.createdAt).toLocaleDateString();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${booking.confirmationCode}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            color: #333; 
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #0066FF; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .logo { 
            font-size: 24px; 
            font-weight: bold; 
            color: #0066FF; 
            margin-bottom: 10px; 
        }
        .receipt-details { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 30px; 
        }
        .detail-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 10px; 
        }
        .detail-label { 
            font-weight: bold; 
            color: #666; 
        }
        .service-details { 
            margin-bottom: 30px; 
        }
        .service-name { 
            font-size: 20px; 
            font-weight: bold; 
            margin-bottom: 10px; 
        }
        .payment-breakdown { 
            border-top: 2px solid #eee; 
            padding-top: 20px; 
            margin-top: 30px; 
        }
        .breakdown-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 8px; 
        }
        .total-row { 
            border-top: 1px solid #ddd; 
            padding-top: 10px; 
            font-weight: bold; 
            font-size: 18px; 
        }
        .footer { 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
        }
        @media print {
            body { 
                margin: 0; 
                padding: 15px; 
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Ecosystem Marketplace</div>
        <div>Service Booking Receipt</div>
    </div>

    <div class="receipt-details">
        <div class="detail-row">
            <span class="detail-label">Receipt #</span>
            <span>${booking.confirmationCode}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Booking Date</span>
            <span>${bookingDate}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Payment Date</span>
            <span>${paymentDate}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Customer</span>
            <span>${customer?.firstName} ${customer?.lastName} ${customer?.email ? `(${customer.email})` : ''}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status</span>
            <span style="text-transform: capitalize;">${booking.status}</span>
        </div>
    </div>

    <div class="service-details">
        <div class="service-name">${booking.serviceName}</div>
        <div>Provider: ${booking.metadata?.providerBusinessName || booking.metadata?.providerName || 'Provider'}</div>
        <div>Scheduled: ${bookingDate} at ${booking.startTime} - ${booking.endTime}</div>
        <div>Duration: ${booking.serviceDuration} minutes</div>
        ${booking.customerNotes ? `<div>Notes: ${booking.customerNotes}</div>` : ''}
    </div>

    <div class="payment-breakdown">
        <h3>Payment Breakdown</h3>
        
        <div class="breakdown-row">
            <span>Service Amount</span>
            <span>$${booking.servicePrice}</span>
        </div>
        
        ${booking.isGuestBooking ? `
        <div class="breakdown-row">
            <span>Guest Service Fee (10%)</span>
            <span>$${(parseFloat(booking.totalAmount) - parseFloat(booking.servicePrice)).toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div class="breakdown-row total-row">
            <span>Total Paid</span>
            <span>$${booking.totalAmount}</span>
        </div>
        
        ${transaction?.refundAmount ? `
        <div class="breakdown-row" style="color: #dc3545;">
            <span>Refunded</span>
            <span>-$${transaction.refundAmount}</span>
        </div>
        <div class="breakdown-row total-row" style="color: #28a745;">
            <span>Net Amount</span>
            <span>$${(parseFloat(booking.totalAmount) - parseFloat(transaction.refundAmount)).toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <div class="breakdown-row">
                <span>Platform Fee (10%)</span>
                <span>$${booking.platformFee}</span>
            </div>
            <div class="breakdown-row">
                <span>Provider Payout (90%)</span>
                <span>$${booking.providerPayout}</span>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>Thank you for using Ecosystem Marketplace!</p>
        <p>Questions? Contact support at support@ecosystem.com</p>
        <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        ${transaction?.stripeChargeId ? `<p>Stripe Charge ID: ${transaction.stripeChargeId}</p>` : ''}
    </div>
</body>
</html>`;
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}