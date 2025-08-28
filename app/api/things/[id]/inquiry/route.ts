import { NextRequest, NextResponse } from "next/server";
import { getThingById, createInquiry } from "@/db/queries/things-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody } from "@/lib/security/api-handler";
import { sendEmail } from "@/lib/sendgrid/email-service";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

/**
 * Thing Inquiry/Offer API
 * POST /api/things/[id]/inquiry - Send an inquiry or make an offer
 */

// Inquiry schema
const inquirySchema = z.object({
  message: z.string().min(10).max(1000),
  offerAmount: z.number().min(0).optional(),
  contactMethod: z.enum(["app", "email", "phone", "text"]).optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
}).refine(data => {
  // If contact method is phone or text, phone number is required
  if ((data.contactMethod === "phone" || data.contactMethod === "text") && !data.phoneNumber) {
    throw new Error("Phone number is required for phone/text contact");
  }
  // If contact method is email, email is required
  if (data.contactMethod === "email" && !data.email) {
    throw new Error("Email is required for email contact");
  }
  return true;
});

/**
 * POST handler - Send inquiry or make offer
 */
async function handleCreateInquiry(req: NextRequest, context: { userId?: string | null; params?: Record<string, string>; searchParams?: URLSearchParams }) {
  try {
    const { userId, params } = context;
    const thingId = params?.id;

    if (!userId) {
      return createApiError("Authentication required", { status: 401 });
    }

    if (!thingId) {
      return createApiError("Thing ID is required", { status: 400 });
    }
    const body = getValidatedBody<z.infer<typeof inquirySchema>>(req);
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Get the thing
    const thing = await getThingById(thingId);
    
    if (!thing) {
      return createApiError("Thing not found", { status: 404 });
    }
    
    if (thing.status !== "active") {
      return createApiError("This item is no longer available", { 
        status: 400,
        code: "ITEM_NOT_AVAILABLE"
      });
    }
    
    // Can't inquire about your own item
    if (thing.sellerId === userId) {
      return createApiError("You cannot inquire about your own listing", { 
        status: 400,
        code: "OWN_LISTING"
      });
    }
    
    // Get buyer's profile
    const [buyerProfile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);
    
    if (!buyerProfile) {
      return createApiError("Please complete your profile before making inquiries", { 
        status: 403,
        code: "PROFILE_REQUIRED"
      });
    }
    
    // Create the inquiry
    const inquiry = await createInquiry({
      thingId,
      fromUserId: userId,
      message: body.message,
      offerAmount: body.offerAmount,
    });
    
    // Build contact info for the message
    let contactInfo = `Preferred contact: ${body.contactMethod || "In-app message"}`;
    if (body.phoneNumber) {
      contactInfo += `\nPhone: ${body.phoneNumber}`;
    }
    if (body.email) {
      contactInfo += `\nEmail: ${body.email}`;
    }
    
    // Send notification email to seller if they have email notifications enabled
    if (thing.seller && thing.contactEmail && thing.preferredContact !== "app") {
      const emailSubject = body.offerAmount 
        ? `New offer of $${body.offerAmount} for "${thing.title}"`
        : `New inquiry about "${thing.title}"`;
      
      const emailBody = `
        <h2>${emailSubject}</h2>
        <p><strong>From:</strong> ${buyerProfile.email || 'Anonymous User'}</p>
        ${body.offerAmount ? `<p><strong>Offer Amount:</strong> $${body.offerAmount}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${body.message}</p>
        <p><strong>${contactInfo}</strong></p>
        <hr>
        <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/marketplace/things/${thingId}">View Listing</a></p>
      `;
      
      try {
        await sendEmail({
          to: thing.contactEmail,
          subject: emailSubject,
          html: emailBody,
        });
      } catch (emailError) {
        console.error("Failed to send inquiry email notification:", emailError);
        // Don't fail the inquiry if email fails
      }
    }
    
    return createApiResponse(
      { 
        inquiry: {
          id: inquiry.id,
          message: inquiry.message,
          offerAmount: inquiry.offerAmount ? Number(inquiry.offerAmount) : null,
          status: inquiry.status,
          createdAt: inquiry.createdAt,
        }
      },
      { 
        status: 201,
        message: body.offerAmount 
          ? "Your offer has been sent to the seller"
          : "Your inquiry has been sent to the seller"
      }
    );
    
  } catch (error) {
    console.error("Error creating inquiry:", error);
    return createApiError("Failed to send inquiry", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// POST: Protected endpoint for creating inquiries
export const POST = createSecureApiHandler(
  handleCreateInquiry,
  {
    requireAuth: true,
    validateBody: inquirySchema,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);