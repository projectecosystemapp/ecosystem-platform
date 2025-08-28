// @ts-nocheck
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, sql } from "drizzle-orm";
import { ApiResponse, getPaginationParams, withErrorHandler } from "@/lib/api-response";

// Service creation schema for providers
const createServiceSchema = z.object({
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

// Bulk update schema
const bulkUpdateSchema = z.object({
  services: z.array(z.object({
    id: z.string().uuid(),
    isActive: z.boolean().optional(),
    basePrice: z.number().positive().optional(),
    requiresApproval: z.boolean().optional(),
  })),
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/providers/[id]/services - Get all services for a provider
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  return withErrorHandler(async () => {
    const providerId = params.id;
    const { searchParams } = new URL(req.url);
    const { page, pageSize, offset } = getPaginationParams(searchParams);
    const isActive = searchParams.get("isActive");
    
    // Verify provider exists
    const [provider] = await db
      .select({
        id: providersTable.id,
        displayName: providersTable.displayName,
        isActive: providersTable.isActive,
      })
      .from(providersTable)
      .where(eq(providersTable.id, providerId));
    
    if (!provider) {
      return ApiResponse.notFound("Provider");
    }
    
    // Build query conditions
    const conditions = [eq(servicesTable.providerId, providerId)];
    
    if (isActive !== null) {
      conditions.push(eq(servicesTable.isActive, isActive === "true"));
    }
    
    // Get services with statistics
    const [services, [{ total }]] = await Promise.all([
      db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          description: servicesTable.description,
          category: servicesTable.category,
          subcategory: servicesTable.subcategory,
          basePrice: servicesTable.basePrice,
          priceType: servicesTable.priceType,
          minimumDuration: servicesTable.minimumDuration,
          maximumDuration: servicesTable.maximumDuration,
          bufferTimeBefore: servicesTable.bufferTimeBefore,
          bufferTimeAfter: servicesTable.bufferTimeAfter,
          advanceBookingHours: servicesTable.advanceBookingHours,
          cancellationHours: servicesTable.cancellationHours,
          isActive: servicesTable.isActive,
          requiresApproval: servicesTable.requiresApproval,
          maxGroupSize: servicesTable.maxGroupSize,
          tags: servicesTable.tags,
          requirements: servicesTable.requirements,
          createdAt: servicesTable.createdAt,
          updatedAt: servicesTable.updatedAt,
        })
        .from(servicesTable)
        .where(and(...conditions))
        .limit(pageSize)
        .offset(offset)
        .orderBy(servicesTable.sortOrder, servicesTable.name),
      
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(servicesTable)
        .where(and(...conditions))
    ]);
    
    // Add provider info to response
    const response = {
      provider: {
        id: provider.id,
        displayName: provider.displayName,
        isActive: provider.isActive,
      },
      services,
    };
    
    return ApiResponse.paginated(services, total, page, pageSize);
  });
}

/**
 * POST /api/providers/[id]/services - Create a service for a provider
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const providerId = params.id;
    const body = await req.json();
    const validatedData = createServiceSchema.parse(body);
    
    // Verify the user owns this provider profile
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, providerId));
    
    if (!provider) {
      return ApiResponse.notFound("Provider");
    }
    
    if (provider.userId !== userId) {
      return ApiResponse.forbidden("You can only manage services for your own provider profile");
    }
    
    // Create the service
    const [service] = await db
      .insert(servicesTable)
      .values({
        ...validatedData,
        providerId,
        basePrice: validatedData.basePrice.toString(),
      })
      .returning();
    
    return ApiResponse.created(service, "Service created successfully");
  });
}

/**
 * PATCH /api/providers/[id]/services - Bulk update services
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const providerId = params.id;
    const body = await req.json();
    const validatedData = bulkUpdateSchema.parse(body);
    
    // Verify the user owns this provider profile
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, providerId));
    
    if (!provider) {
      return ApiResponse.notFound("Provider");
    }
    
    if (provider.userId !== userId) {
      return ApiResponse.forbidden("You can only manage services for your own provider profile");
    }
    
    // Verify all service IDs belong to this provider
    const serviceIds = validatedData.services.map(s => s.id);
    const existingServices = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.providerId, providerId),
          sql`${servicesTable.id} = ANY(${serviceIds})`
        )
      );
    
    if (existingServices.length !== serviceIds.length) {
      return ApiResponse.validationError({ 
        services: "Some services do not belong to this provider" 
      });
    }
    
    // Perform bulk updates
    const updatedServices = await Promise.all(
      validatedData.services.map(async (serviceUpdate) => {
        const updateData: any = { updatedAt: new Date() };
        
        if (serviceUpdate.isActive !== undefined) {
          updateData.isActive = serviceUpdate.isActive;
        }
        
        if (serviceUpdate.basePrice !== undefined) {
          updateData.basePrice = serviceUpdate.basePrice.toString();
        }
        
        if (serviceUpdate.requiresApproval !== undefined) {
          updateData.requiresApproval = serviceUpdate.requiresApproval;
        }
        
        const [updated] = await db
          .update(servicesTable)
          .set(updateData)
          .where(eq(servicesTable.id, serviceUpdate.id))
          .returning();
        
        return updated;
      })
    );
    
    return ApiResponse.success(updatedServices, "Services updated successfully");
  });
}

/**
 * DELETE /api/providers/[id]/services - Delete all services for a provider
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    const providerId = params.id;
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");
    
    // Verify the user owns this provider profile
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, providerId));
    
    if (!provider) {
      return ApiResponse.notFound("Provider");
    }
    
    if (provider.userId !== userId) {
      return ApiResponse.forbidden("You can only manage services for your own provider profile");
    }
    
    if (serviceId) {
      // Delete specific service
      const [service] = await db
        .select({ id: servicesTable.id })
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.id, serviceId),
            eq(servicesTable.providerId, providerId)
          )
        );
      
      if (!service) {
        return ApiResponse.notFound("Service");
      }
      
      // Soft delete the service
      await db
        .update(servicesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(servicesTable.id, serviceId));
      
      return ApiResponse.success({ id: serviceId }, "Service deleted successfully");
    } else {
      // Soft delete all services for the provider
      const result = await db
        .update(servicesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(servicesTable.providerId, providerId))
        .returning({ id: servicesTable.id });
      
      return ApiResponse.success(
        { deletedCount: result.length }, 
        `${result.length} services deleted successfully`
      );
    }
  });
}