import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  surgePricingEventsTable,
  demandMetricsTable,
  priceHistoryTable,
  type NewSurgePricingEvent,
  type SurgePricingEvent 
} from "@/db/schema/pricing-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { and, eq, gte, lte, or, sql, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * Surge Pricing Events Management API
 * GET /api/pricing/surge - List surge pricing events
 * POST /api/pricing/surge - Create/activate surge pricing
 * PUT /api/pricing/surge - Update surge pricing event
 * DELETE /api/pricing/surge - Deactivate surge pricing
 */

// Validation schemas
const listSurgeEventsSchema = z.object({
  providerId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const createSurgeEventSchema = z.object({
  providerId: z.string().uuid(),
  eventName: z.string().min(1).max(100).optional(),
  eventType: z.enum(["automatic", "manual", "holiday", "weather", "special_event"]).default("manual"),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  surgeMultiplier: z.number().min(1.0).max(5.0), // Max 5x surge
  affectedServices: z.array(z.string().uuid()).optional(),
  triggerReason: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  autoTrigger: z.boolean().default(false),
});

const updateSurgeEventSchema = z.object({
  id: z.string().uuid(),
  endTime: z.string().datetime().optional(),
  surgeMultiplier: z.number().min(1.0).max(5.0).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const triggerAutoSurgeSchema = z.object({
  providerId: z.string().uuid(),
  demandThreshold: z.number().min(0).max(10).default(7.5),
  minBookingsPerHour: z.number().int().positive().default(5),
  lookbackHours: z.number().int().positive().default(2),
  durationMinutes: z.number().int().min(30).max(240).default(60),
  maxMultiplier: z.number().min(1.0).max(3.0).default(2.0),
});

// GET - List surge pricing events
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams.entries());
    
    const parseResult = listSurgeEventsSchema.safeParse(params);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parseResult.error.errors },
        { status: 400 }
      );
    }
    
    const { providerId, isActive, startDate, endDate, limit, offset } = parseResult.data;
    
    // Verify provider ownership
    const provider = await db.select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);
    
    if (!provider.length || provider[0].userId !== userId) {
      return NextResponse.json(
        { error: "Provider not found or unauthorized" },
        { status: 403 }
      );
    }
    
    // Build query conditions
    const conditions = [eq(surgePricingEventsTable.providerId, providerId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(surgePricingEventsTable.isActive, isActive));
    }
    
    if (startDate) {
      conditions.push(gte(surgePricingEventsTable.startTime, new Date(startDate)));
    }
    
    if (endDate) {
      conditions.push(lte(surgePricingEventsTable.endTime, new Date(endDate)));
    }
    
    // Fetch surge events
    const events = await db.select()
      .from(surgePricingEventsTable)
      .where(and(...conditions))
      .orderBy(desc(surgePricingEventsTable.startTime))
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const totalResult = await db.select({ count: sql`count(*)` })
      .from(surgePricingEventsTable)
      .where(and(...conditions));
    
    const total = Number(totalResult[0].count);
    
    // Calculate impact for each event
    const eventsWithImpact = await Promise.all(events.map(async (event) => {
      // Get affected bookings count during surge period
      const bookingsResult = await db.select({ count: sql`count(*)` })
        .from(bookingsTable)
        .where(and(
          eq(bookingsTable.providerId, providerId),
          gte(bookingsTable.createdAt, event.startTime),
          lte(bookingsTable.createdAt, event.endTime)
        ));
      
      const bookingsCount = Number(bookingsResult[0].count);
      
      return {
        ...event,
        surgeMultiplier: parseFloat(event.surgeMultiplier),
        demandScore: event.demandScore ? parseFloat(event.demandScore) : null,
        bookingsAffected: event.bookingsAffected || bookingsCount,
        revenueImpact: event.additionalRevenueCents ? event.additionalRevenueCents / 100 : 0,
        status: getSurgeStatus(event),
      };
    }));
    
    return NextResponse.json({
      events: eventsWithImpact,
      total,
      hasMore: offset + limit < total,
    });
    
  } catch (error) {
    console.error("Error fetching surge events:", error);
    return NextResponse.json(
      { error: "Failed to fetch surge events" },
      { status: 500 }
    );
  }
}

// POST - Create/activate surge pricing
export const POST = withRateLimit(
  'api',
  async (req: NextRequest) => {
    try {
      const { userId } = auth();
      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      
      const body = await req.json();
      
      // Check if this is an auto-trigger request
      if (body.autoTrigger) {
        return handleAutoSurgeTrigger(userId, body);
      }
      
      const parseResult = createSurgeEventSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: parseResult.error.errors },
          { status: 400 }
        );
      }
      
      const data = parseResult.data;
      
      // Verify provider ownership
      const provider = await db.select({ userId: providersTable.userId })
        .from(providersTable)
        .where(eq(providersTable.id, data.providerId))
        .limit(1);
      
      if (!provider.length || provider[0].userId !== userId) {
        return NextResponse.json(
          { error: "Provider not found or unauthorized" },
          { status: 403 }
        );
      }
      
      // Validate date range
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      
      if (startTime >= endTime) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 }
        );
      }
      
      if (endTime.getTime() - startTime.getTime() > 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "Surge pricing cannot exceed 24 hours" },
          { status: 400 }
        );
      }
      
      // Check for overlapping active surge events
      const overlapping = await db.select({ id: surgePricingEventsTable.id })
        .from(surgePricingEventsTable)
        .where(and(
          eq(surgePricingEventsTable.providerId, data.providerId),
          eq(surgePricingEventsTable.isActive, true),
          or(
            and(
              lte(surgePricingEventsTable.startTime, startTime),
              gte(surgePricingEventsTable.endTime, startTime)
            ),
            and(
              lte(surgePricingEventsTable.startTime, endTime),
              gte(surgePricingEventsTable.endTime, endTime)
            ),
            and(
              gte(surgePricingEventsTable.startTime, startTime),
              lte(surgePricingEventsTable.endTime, endTime)
            )
          )
        ))
        .limit(1);
      
      if (overlapping.length > 0) {
        return NextResponse.json(
          { error: "Overlapping surge event already exists" },
          { status: 409 }
        );
      }
      
      // Verify affected services belong to provider
      if (data.affectedServices && data.affectedServices.length > 0) {
        const services = await db.select({ id: servicesTable.id })
          .from(servicesTable)
          .where(and(
            eq(servicesTable.providerId, data.providerId),
            sql`${servicesTable.id} IN (${sql.join(data.affectedServices.map(id => sql`${id}`), sql`, `)})`
          ));
        
        if (services.length !== data.affectedServices.length) {
          return NextResponse.json(
            { error: "Some services not found or don't belong to provider" },
            { status: 404 }
          );
        }
      }
      
      // Calculate current demand if not provided
      let demandScore: number | null = null;
      if (startTime <= new Date()) {
        const currentHour = new Date().getHours();
        const demandMetric = await db.select()
          .from(demandMetricsTable)
          .where(and(
            eq(demandMetricsTable.providerId, data.providerId),
            eq(demandMetricsTable.date, new Date().toISOString().split('T')[0]),
            eq(demandMetricsTable.hour, currentHour)
          ))
          .limit(1);
        
        if (demandMetric.length > 0) {
          demandScore = parseFloat(demandMetric[0].demandScore || "0");
        }
      }
      
      // Create surge event
      const newSurgeEvent: NewSurgePricingEvent = {
        providerId: data.providerId,
        eventName: data.eventName || `Surge ${data.surgeMultiplier}x`,
        eventType: data.eventType,
        startTime,
        endTime,
        surgeMultiplier: data.surgeMultiplier.toString(),
        demandScore: demandScore?.toString(),
        affectedServices: data.affectedServices || [],
        isActive: true,
        wasAutoTriggered: false,
        triggerReason: data.triggerReason,
        metadata: data.metadata,
      };
      
      const [createdEvent] = await db.insert(surgePricingEventsTable)
        .values(newSurgeEvent)
        .returning();
      
      // Log surge activation in price history
      if (data.affectedServices && data.affectedServices.length > 0) {
        for (const serviceId of data.affectedServices) {
          await db.insert(priceHistoryTable).values({
            serviceId,
            oldPriceCents: 0, // Will be calculated at booking time
            newPriceCents: 0, // Will be calculated at booking time
            changePercent: ((data.surgeMultiplier - 1) * 100).toString(),
            appliedRules: [{ surgeEventId: createdEvent.id, multiplier: data.surgeMultiplier }],
            finalModifier: data.surgeMultiplier.toString(),
            demandLevel: demandScore ? getDemandLevelFromScore(demandScore) : 'normal',
            changeReason: `Surge pricing activated: ${data.eventName || 'Manual surge'}`,
            changedBy: `user:${userId}`,
            effectiveFrom: startTime,
            effectiveUntil: endTime,
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        event: {
          ...createdEvent,
          surgeMultiplier: parseFloat(createdEvent.surgeMultiplier),
          demandScore: createdEvent.demandScore ? parseFloat(createdEvent.demandScore) : null,
        },
      });
      
    } catch (error) {
      console.error("Error creating surge event:", error);
      return NextResponse.json(
        { error: "Failed to create surge event" },
        { status: 500 }
      );
    }
  }
);

// PUT - Update surge pricing event
export const PUT = withRateLimit(
  'api',
  async (req: NextRequest) => {
    try {
      const { userId } = auth();
      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      
      const body = await req.json();
      
      const parseResult = updateSurgeEventSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: parseResult.error.errors },
          { status: 400 }
        );
      }
      
      const { id, ...updateData } = parseResult.data;
      
      // Get existing event and verify ownership
      const existingEvent = await db.select({
        event: surgePricingEventsTable,
        userId: providersTable.userId,
      })
      .from(surgePricingEventsTable)
      .innerJoin(providersTable, eq(surgePricingEventsTable.providerId, providersTable.id))
      .where(eq(surgePricingEventsTable.id, id))
      .limit(1);
      
      if (!existingEvent.length || existingEvent[0].userId !== userId) {
        return NextResponse.json(
          { error: "Surge event not found or unauthorized" },
          { status: 403 }
        );
      }
      
      const event = existingEvent[0].event;
      
      // Validate end time if updating
      if (updateData.endTime) {
        const newEndTime = new Date(updateData.endTime);
        if (newEndTime <= event.startTime) {
          return NextResponse.json(
            { error: "End time must be after start time" },
            { status: 400 }
          );
        }
      }
      
      // Build update object
      const updates: any = {};
      
      if (updateData.endTime !== undefined) updates.endTime = new Date(updateData.endTime);
      if (updateData.surgeMultiplier !== undefined) updates.surgeMultiplier = updateData.surgeMultiplier.toString();
      if (updateData.isActive !== undefined) updates.isActive = updateData.isActive;
      if (updateData.metadata !== undefined) updates.metadata = updateData.metadata;
      
      const [updatedEvent] = await db.update(surgePricingEventsTable)
        .set(updates)
        .where(eq(surgePricingEventsTable.id, id))
        .returning();
      
      // If deactivating, update bookings affected count
      if (updateData.isActive === false && event.isActive === true) {
        const bookingsResult = await db.select({ 
          count: sql`count(*)`,
          totalRevenue: sql`sum(total_price_cents)`,
        })
        .from(bookingsTable)
        .where(and(
          eq(bookingsTable.providerId, event.providerId),
          gte(bookingsTable.createdAt, event.startTime),
          lte(bookingsTable.createdAt, updatedEvent.endTime)
        ));
        
        const bookingsCount = Number(bookingsResult[0].count);
        const totalRevenue = Number(bookingsResult[0].totalRevenue || 0);
        const baseRevenue = totalRevenue / parseFloat(event.surgeMultiplier);
        const additionalRevenue = totalRevenue - baseRevenue;
        
        await db.update(surgePricingEventsTable)
          .set({
            bookingsAffected: bookingsCount,
            additionalRevenueCents: Math.round(additionalRevenue),
          })
          .where(eq(surgePricingEventsTable.id, id));
      }
      
      return NextResponse.json({
        success: true,
        event: {
          ...updatedEvent,
          surgeMultiplier: parseFloat(updatedEvent.surgeMultiplier),
          demandScore: updatedEvent.demandScore ? parseFloat(updatedEvent.demandScore) : null,
        },
      });
      
    } catch (error) {
      console.error("Error updating surge event:", error);
      return NextResponse.json(
        { error: "Failed to update surge event" },
        { status: 500 }
      );
    }
  }
);

// DELETE - Deactivate surge pricing
export const DELETE = withRateLimit(
  'api',
  async (req: NextRequest) => {
    try {
      const { userId } = auth();
      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      
      if (!id) {
        return NextResponse.json(
          { error: "Surge event ID required" },
          { status: 400 }
        );
      }
      
      // Get event and verify ownership
      const existingEvent = await db.select({
        event: surgePricingEventsTable,
        userId: providersTable.userId,
      })
      .from(surgePricingEventsTable)
      .innerJoin(providersTable, eq(surgePricingEventsTable.providerId, providersTable.id))
      .where(eq(surgePricingEventsTable.id, id))
      .limit(1);
      
      if (!existingEvent.length || existingEvent[0].userId !== userId) {
        return NextResponse.json(
          { error: "Surge event not found or unauthorized" },
          { status: 403 }
        );
      }
      
      // Deactivate the event
      const [deactivatedEvent] = await db.update(surgePricingEventsTable)
        .set({
          isActive: false,
          endTime: new Date(), // End it now
        })
        .where(eq(surgePricingEventsTable.id, id))
        .returning();
      
      return NextResponse.json({
        success: true,
        message: "Surge pricing deactivated",
        event: {
          ...deactivatedEvent,
          surgeMultiplier: parseFloat(deactivatedEvent.surgeMultiplier),
        },
      });
      
    } catch (error) {
      console.error("Error deactivating surge event:", error);
      return NextResponse.json(
        { error: "Failed to deactivate surge event" },
        { status: 500 }
      );
    }
  }
);

// Helper function to handle automatic surge triggering
async function handleAutoSurgeTrigger(userId: string, body: any) {
  const parseResult = triggerAutoSurgeSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid auto-trigger parameters", details: parseResult.error.errors },
      { status: 400 }
    );
  }
  
  const { 
    providerId, 
    demandThreshold, 
    minBookingsPerHour,
    lookbackHours,
    durationMinutes,
    maxMultiplier 
  } = parseResult.data;
  
  // Verify provider ownership
  const provider = await db.select({ userId: providersTable.userId })
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);
  
  if (!provider.length || provider[0].userId !== userId) {
    return NextResponse.json(
      { error: "Provider not found or unauthorized" },
      { status: 403 }
    );
  }
  
  // Check if surge is already active
  const activeSurge = await db.select({ id: surgePricingEventsTable.id })
    .from(surgePricingEventsTable)
    .where(and(
      eq(surgePricingEventsTable.providerId, providerId),
      eq(surgePricingEventsTable.isActive, true),
      gte(surgePricingEventsTable.endTime, new Date())
    ))
    .limit(1);
  
  if (activeSurge.length > 0) {
    return NextResponse.json(
      { error: "Surge pricing already active" },
      { status: 409 }
    );
  }
  
  // Calculate current demand
  const now = new Date();
  const lookbackTime = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  
  // Get recent bookings count
  const recentBookings = await db.select({ 
    count: sql`count(*)`,
    hourlyRate: sql`count(*) / ${lookbackHours}`,
  })
  .from(bookingsTable)
  .where(and(
    eq(bookingsTable.providerId, providerId),
    gte(bookingsTable.createdAt, lookbackTime)
  ));
  
  const bookingsPerHour = Number(recentBookings[0].hourlyRate || 0);
  
  // Get current demand score
  const currentHour = now.getHours();
  const demandMetric = await db.select()
    .from(demandMetricsTable)
    .where(and(
      eq(demandMetricsTable.providerId, providerId),
      eq(demandMetricsTable.date, now.toISOString().split('T')[0]),
      eq(demandMetricsTable.hour, currentHour)
    ))
    .limit(1);
  
  const demandScore = demandMetric.length > 0 
    ? parseFloat(demandMetric[0].demandScore || "0")
    : calculateDemandScore(bookingsPerHour, minBookingsPerHour);
  
  // Check if conditions are met for auto-surge
  if (demandScore < demandThreshold && bookingsPerHour < minBookingsPerHour) {
    return NextResponse.json({
      success: false,
      message: "Demand conditions not met for auto-surge",
      metrics: {
        currentDemandScore: demandScore,
        requiredDemandScore: demandThreshold,
        currentBookingsPerHour: bookingsPerHour,
        requiredBookingsPerHour: minBookingsPerHour,
      },
    });
  }
  
  // Calculate surge multiplier based on demand
  const surgeMultiplier = Math.min(
    maxMultiplier,
    1 + (demandScore / 10) * (maxMultiplier - 1)
  );
  
  // Create auto-triggered surge event
  const startTime = now;
  const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
  
  const newSurgeEvent: NewSurgePricingEvent = {
    providerId,
    eventName: `Auto-Surge ${surgeMultiplier.toFixed(1)}x`,
    eventType: "automatic",
    startTime,
    endTime,
    surgeMultiplier: surgeMultiplier.toString(),
    demandScore: demandScore.toString(),
    affectedServices: [], // Affects all services
    isActive: true,
    wasAutoTriggered: true,
    triggerReason: `High demand detected: ${demandScore.toFixed(1)}/10, ${bookingsPerHour.toFixed(1)} bookings/hour`,
    metadata: {
      demandThreshold,
      minBookingsPerHour,
      lookbackHours,
      durationMinutes,
      maxMultiplier,
      bookingsPerHour,
      demandScore,
    },
  };
  
  const [createdEvent] = await db.insert(surgePricingEventsTable)
    .values(newSurgeEvent)
    .returning();
  
  return NextResponse.json({
    success: true,
    message: "Auto-surge activated due to high demand",
    event: {
      ...createdEvent,
      surgeMultiplier: parseFloat(createdEvent.surgeMultiplier),
      demandScore: parseFloat(createdEvent.demandScore || "0"),
    },
    metrics: {
      demandScore,
      bookingsPerHour,
      calculatedMultiplier: surgeMultiplier,
    },
  });
}

// Helper function to get surge status
function getSurgeStatus(event: SurgePricingEvent): string {
  const now = new Date();
  if (!event.isActive) return 'inactive';
  if (event.endTime < now) return 'expired';
  if (event.startTime > now) return 'scheduled';
  return 'active';
}

// Helper function to calculate demand score
function calculateDemandScore(bookingsPerHour: number, baseline: number): number {
  if (bookingsPerHour === 0) return 0;
  const ratio = bookingsPerHour / baseline;
  return Math.min(10, ratio * 5); // Scale 0-10
}

// Helper function to get demand level from score
function getDemandLevelFromScore(score: number): string {
  if (score < 2) return 'very_low';
  if (score < 4) return 'low';
  if (score < 6) return 'normal';
  if (score < 7.5) return 'high';
  if (score < 9) return 'very_high';
  return 'extreme';
}