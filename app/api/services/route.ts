import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, or, ilike, sql, gte, lte } from "drizzle-orm";
import { ApiResponse, getPaginationParams, withErrorHandler } from "@/lib/api-response";

// Service creation schema
const createServiceSchema = z.object({
  providerId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  basePrice: z.number().positive(),
  priceType: z.enum(["fixed", "hourly", "custom"]).default("fixed"),
  minimumDuration: z.number().min(15).default(30),
  maximumDuration: z.number().min(15).optional(),
  bufferTimeBefore: z.number().min(0).default(0),
  bufferTimeAfter: z.number().min(0).default(0),
  advanceBookingHours: z.number().min(0).default(24),
  cancellationHours: z.number().min(0).default(24),
  requiresApproval: z.boolean().default(false),
  maxGroupSize: z.number().min(1).default(1),
  tags: z.array(z.string()).default([]),
  requirements: z.object({
    equipment: z.array(z.string()).optional(),
    preparation: z.string().optional(),
    restrictions: z.array(z.string()).optional(),
  }).default({}),
});

// Service update schema (partial)
const updateServiceSchema = createServiceSchema.partial();

// Search filters schema
const searchFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  providerId: z.string().uuid().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  priceType: z.enum(["fixed", "hourly", "custom"]).optional(),
  requiresApproval: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/services - List and search services
 */
export async function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, offset } = getPaginationParams(searchParams);
    
    // Parse filters
    const filters = searchFiltersSchema.parse(
      Object.fromEntries(searchParams.entries())
    );
    
    // Build query conditions
    const conditions = [];
    
    if (filters.query) {
      conditions.push(
        or(
          ilike(servicesTable.name, `%${filters.query}%`),
          ilike(servicesTable.description, `%${filters.query}%`)
        )
      );
    }
    
    if (filters.category) {
      conditions.push(eq(servicesTable.category, filters.category));
    }
    
    if (filters.subcategory) {
      conditions.push(eq(servicesTable.subcategory, filters.subcategory));
    }
    
    if (filters.providerId) {
      conditions.push(eq(servicesTable.providerId, filters.providerId));
    }
    
    if (filters.minPrice !== undefined) {
      conditions.push(gte(servicesTable.basePrice, filters.minPrice.toString()));
    }
    
    if (filters.maxPrice !== undefined) {
      conditions.push(lte(servicesTable.basePrice, filters.maxPrice.toString()));
    }
    
    if (filters.priceType) {
      conditions.push(eq(servicesTable.priceType, filters.priceType));
    }
    
    if (filters.requiresApproval !== undefined) {
      conditions.push(eq(servicesTable.requiresApproval, filters.requiresApproval));
    }
    
    if (filters.isActive !== undefined) {
      conditions.push(eq(servicesTable.isActive, filters.isActive));
    }
    
    // Execute query with joins
    const [services, [{ total }]] = await Promise.all([
      db
        .select({
          service: servicesTable,
          provider: {
            id: providersTable.id,
            displayName: providersTable.displayName,
            profileImageUrl: providersTable.profileImageUrl,
            averageRating: providersTable.averageRating,
            totalReviews: providersTable.totalReviews,
          }
        })
        .from(servicesTable)
        .leftJoin(providersTable, eq(servicesTable.providerId, providersTable.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(pageSize)
        .offset(offset)
        .orderBy(sql`${servicesTable.createdAt} DESC`),
      
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(servicesTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);
    
    return ApiResponse.paginated(services, total, page, pageSize);
  });
}

/**
 * POST /api/services - Create a new service
 */
export async function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const body = await req.json();
    const validatedData = createServiceSchema.parse(body);
    
    // Verify the user owns the provider profile
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, validatedData.providerId));
    
    if (!provider || provider.userId !== userId) {
      return ApiResponse.forbidden("You can only create services for your own provider profile");
    }
    
    // Create the service
    const [service] = await db
      .insert(servicesTable)
      .values({
        ...validatedData,
        basePrice: validatedData.basePrice.toString(),
      })
      .returning();
    
    return ApiResponse.created(service, "Service created successfully");
  });
}

/**
 * PATCH /api/services - Update a service
 */
export async function PATCH(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("id");
    
    if (!serviceId) {
      return ApiResponse.validationError({ id: "Service ID is required" });
    }
    
    const body = await req.json();
    const validatedData = updateServiceSchema.parse(body);
    
    // Get the service with provider info
    const [existingService] = await db
      .select({
        service: servicesTable,
        providerUserId: providersTable.userId,
      })
      .from(servicesTable)
      .leftJoin(providersTable, eq(servicesTable.providerId, providersTable.id))
      .where(eq(servicesTable.id, serviceId));
    
    if (!existingService) {
      return ApiResponse.notFound("Service");
    }
    
    if (existingService.providerUserId !== userId) {
      return ApiResponse.forbidden("You can only update your own services");
    }
    
    // Update the service
    const updateData: any = { ...validatedData, updatedAt: new Date() };
    if (validatedData.basePrice !== undefined) {
      updateData.basePrice = validatedData.basePrice.toString();
    }
    
    const [updatedService] = await db
      .update(servicesTable)
      .set(updateData)
      .where(eq(servicesTable.id, serviceId))
      .returning();
    
    return ApiResponse.success(updatedService, "Service updated successfully");
  });
}

/**
 * DELETE /api/services - Delete a service
 */
export async function DELETE(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("id");
    
    if (!serviceId) {
      return ApiResponse.validationError({ id: "Service ID is required" });
    }
    
    // Get the service with provider info
    const [existingService] = await db
      .select({
        service: servicesTable,
        providerUserId: providersTable.userId,
      })
      .from(servicesTable)
      .leftJoin(providersTable, eq(servicesTable.providerId, providersTable.id))
      .where(eq(servicesTable.id, serviceId));
    
    if (!existingService) {
      return ApiResponse.notFound("Service");
    }
    
    if (existingService.providerUserId !== userId) {
      return ApiResponse.forbidden("You can only delete your own services");
    }
    
    // Soft delete by setting isActive to false
    await db
      .update(servicesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(servicesTable.id, serviceId));
    
    return ApiResponse.noContent();
  });
}