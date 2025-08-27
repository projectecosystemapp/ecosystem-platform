import { NextRequest, NextResponse } from "next/server";
import { getThingById, updateThing, deleteThing } from "@/db/queries/things-queries";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody } from "@/lib/security/api-handler";

/**
 * Individual Thing API
 * GET /api/things/[id] - Get a single thing by ID
 * PATCH /api/things/[id] - Update a thing (owner only)
 * DELETE /api/things/[id] - Delete a thing (owner only)
 */

// Update thing schema
const updateThingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  category: z.enum([
    "electronics",
    "furniture",
    "clothing",
    "tools",
    "sports",
    "books",
    "toys",
    "appliances",
    "automotive",
    "garden",
    "music",
    "art",
    "collectibles",
    "other",
  ]).optional(),
  subcategory: z.string().optional(),
  condition: z.enum([
    "new",
    "like_new",
    "excellent",
    "good",
    "fair",
    "for_parts",
  ]).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  
  // Pricing
  price: z.number().min(0).optional(),
  originalPrice: z.number().min(0).optional(),
  negotiable: z.boolean().optional(),
  
  // Media
  images: z.array(z.string().url()).min(1).max(10).optional(),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  
  // Location
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().min(2).max(2).optional(),
  zipCode: z.string().min(5).max(10).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  // Availability
  status: z.enum(["draft", "active", "pending", "sold", "reserved", "expired", "deleted"]).optional(),
  quantity: z.number().min(0).optional(),
  availableFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  availableUntil: z.string().optional().transform(val => val ? new Date(val) : undefined),
  
  // Delivery options
  shippingAvailable: z.boolean().optional(),
  shippingCost: z.number().min(0).optional(),
  localPickupOnly: z.boolean().optional(),
  deliveryRadius: z.number().min(1).max(100).optional(),
  
  // Contact preferences
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  preferredContact: z.enum(["app", "email", "phone", "text"]).optional(),
  
  // Additional details
  specifications: z.record(z.any()).optional(),
  tags: z.array(z.string()).max(10).optional(),
  yearManufactured: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  dimensions: z.object({
    length: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    weight: z.number().optional(),
    unit: z.string().optional(),
  }).optional(),
  
  // SEO
  keywords: z.string().optional(),
}).refine(data => {
  // Validate shipping settings if provided
  if (data.shippingAvailable === true && data.shippingCost === undefined) {
    throw new Error("Shipping cost is required when shipping is available");
  }
  if (data.originalPrice && data.price && data.originalPrice <= data.price) {
    throw new Error("Original price must be higher than current price");
  }
  return true;
});

/**
 * GET handler - Get a single thing by ID
 */
async function handleGetThing(req: NextRequest, params: { id: string }) {
  try {
    const { id } = params;
    
    // Check if we should increment view count (not for owner)
    const { userId } = await auth();
    
    // Get the thing
    const thing = await getThingById(id, true); // Always increment view for now
    
    if (!thing) {
      return createApiError("Thing not found", { status: 404 });
    }
    
    // Transform for frontend
    const transformedThing = {
      id: thing.id,
      title: thing.title,
      description: thing.description,
      category: thing.category,
      subcategory: thing.subcategory,
      condition: thing.condition,
      brand: thing.brand,
      model: thing.model,
      price: Number(thing.price),
      originalPrice: thing.originalPrice ? Number(thing.originalPrice) : null,
      negotiable: thing.negotiable,
      currency: thing.currency,
      images: thing.images,
      thumbnailUrl: thing.thumbnailUrl,
      videoUrl: thing.videoUrl,
      location: thing.location,
      city: thing.city,
      state: thing.state,
      zipCode: thing.zipCode,
      latitude: thing.latitude ? Number(thing.latitude) : null,
      longitude: thing.longitude ? Number(thing.longitude) : null,
      status: thing.status,
      quantity: thing.quantity,
      availableFrom: thing.availableFrom,
      availableUntil: thing.availableUntil,
      shippingAvailable: thing.shippingAvailable,
      shippingCost: thing.shippingCost ? Number(thing.shippingCost) : null,
      localPickupOnly: thing.localPickupOnly,
      deliveryRadius: thing.deliveryRadius,
      contactPhone: thing.contactPhone,
      contactEmail: thing.contactEmail,
      preferredContact: thing.preferredContact,
      specifications: thing.specifications,
      tags: thing.tags,
      yearManufactured: thing.yearManufactured,
      dimensions: thing.dimensions,
      viewCount: thing.viewCount,
      favoriteCount: thing.favoriteCount,
      inquiryCount: thing.inquiryCount,
      slug: thing.slug,
      keywords: thing.keywords,
      featured: thing.featured,
      boosted: thing.boosted,
      boostedUntil: thing.boostedUntil,
      createdAt: thing.createdAt,
      updatedAt: thing.updatedAt,
      publishedAt: thing.publishedAt,
      soldAt: thing.soldAt,
      seller: thing.seller,
      isOwner: userId === thing.sellerId,
    };
    
    return createApiResponse({ thing: transformedThing });
    
  } catch (error) {
    console.error("Error getting thing:", error);
    return createApiError("Failed to get thing", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * PATCH handler - Update a thing (owner only)
 */
async function handleUpdateThing(req: NextRequest, params: { id: string }, context: any) {
  try {
    const { userId } = context;
    const { id } = params;
    const body = getValidatedBody<z.infer<typeof updateThingSchema>>(req);
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Get the thing to check ownership
    const thing = await getThingById(id);
    
    if (!thing) {
      return createApiError("Thing not found", { status: 404 });
    }
    
    if (thing.sellerId !== userId) {
      return createApiError("You don't have permission to update this listing", { 
        status: 403,
        code: "NOT_OWNER"
      });
    }
    
    // Prepare update data
    const updateData: any = { ...body };
    
    // Convert numeric fields to strings for database
    if (body.price !== undefined) {
      updateData.price = body.price.toString();
    }
    if (body.originalPrice !== undefined) {
      updateData.originalPrice = body.originalPrice.toString();
    }
    if (body.shippingCost !== undefined) {
      updateData.shippingCost = body.shippingCost.toString();
    }
    if (body.latitude !== undefined) {
      updateData.latitude = body.latitude.toString();
    }
    if (body.longitude !== undefined) {
      updateData.longitude = body.longitude.toString();
    }
    
    // Update the thing
    const updatedThing = await updateThing(id, updateData);
    
    return createApiResponse(
      { thing: updatedThing },
      { message: "Listing updated successfully" }
    );
    
  } catch (error) {
    console.error("Error updating thing:", error);
    return createApiError("Failed to update listing", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * DELETE handler - Delete a thing (owner only)
 */
async function handleDeleteThing(req: NextRequest, params: { id: string }, context: any) {
  try {
    const { userId } = context;
    const { id } = params;
    
    // Get the thing to check ownership
    const thing = await getThingById(id);
    
    if (!thing) {
      return createApiError("Thing not found", { status: 404 });
    }
    
    if (thing.sellerId !== userId) {
      return createApiError("You don't have permission to delete this listing", { 
        status: 403,
        code: "NOT_OWNER"
      });
    }
    
    // Soft delete the thing
    await deleteThing(id);
    
    return createApiResponse(
      { success: true },
      { message: "Listing deleted successfully" }
    );
    
  } catch (error) {
    console.error("Error deleting thing:", error);
    return createApiError("Failed to delete listing", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for getting a thing
export const GET = createSecureApiHandler(
  handleGetThing,
  {
    requireAuth: false,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// PATCH: Protected endpoint for updating a thing
export const PATCH = createSecureApiHandler(
  handleUpdateThing,
  {
    requireAuth: true,
    validateBody: updateThingSchema,
    rateLimit: { requests: 20, window: '1m' },
    auditLog: true,
    allowedMethods: ['PATCH'],
  }
);

// DELETE: Protected endpoint for deleting a thing
export const DELETE = createSecureApiHandler(
  handleDeleteThing,
  {
    requireAuth: true,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['DELETE'],
  }
);