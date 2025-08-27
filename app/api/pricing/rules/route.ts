// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  pricingRulesTable,
  type NewPricingRule,
  type PricingRule 
} from "@/db/schema/pricing-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { and, eq, or, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * Pricing Rules Management API
 * GET /api/pricing/rules - List pricing rules for a provider
 * POST /api/pricing/rules - Create a new pricing rule
 * PUT /api/pricing/rules - Update an existing pricing rule
 * DELETE /api/pricing/rules - Delete a pricing rule
 */

// Validation schemas
const listRulesSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  ruleType: z.enum([
    "time_based",
    "demand_based",
    "seasonal",
    "advance_booking",
    "loyalty",
    "promotional",
    "bundle",
    "group"
  ]).optional(),
});

const createRuleSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid().optional().nullable(),
  ruleType: z.enum([
    "time_based",
    "demand_based",
    "seasonal",
    "advance_booking",
    "loyalty",
    "promotional",
    "bundle",
    "group"
  ]),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  conditions: z.record(z.any()).default({}),
  priceModifier: z.number().positive().max(10), // Max 10x multiplier
  fixedAdjustmentCents: z.number().int().optional(),
  maxPriceCents: z.number().int().positive().optional(),
  minPriceCents: z.number().int().positive().optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  isStackable: z.boolean().default(false),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
  isAutomatic: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

const updateRuleSchema = createRuleSchema.partial().extend({
  id: z.string().uuid(),
});

const deleteRuleSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().uuid(),
});

// GET - List pricing rules
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
    
    const parseResult = listRulesSchema.safeParse(params);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parseResult.error.errors },
        { status: 400 }
      );
    }
    
    const { providerId, serviceId, isActive, ruleType } = parseResult.data;
    
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
    const conditions = [eq(pricingRulesTable.providerId, providerId)];
    
    if (serviceId) {
      conditions.push(or(
        eq(pricingRulesTable.serviceId, serviceId),
        sql`${pricingRulesTable.serviceId} IS NULL`
      ));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(pricingRulesTable.isActive, isActive));
    }
    
    if (ruleType) {
      conditions.push(eq(pricingRulesTable.ruleType, ruleType));
    }
    
    // Fetch rules with service names
    const rules = await db.select({
      rule: pricingRulesTable,
      serviceName: servicesTable.name,
    })
    .from(pricingRulesTable)
    .leftJoin(servicesTable, eq(pricingRulesTable.serviceId, servicesTable.id))
    .where(and(...conditions))
    .orderBy(desc(pricingRulesTable.priority), desc(pricingRulesTable.createdAt));
    
    // Format response
    const formattedRules = rules.map(({ rule, serviceName }) => ({
      ...rule,
      serviceName: serviceName || 'All Services',
      priceModifier: parseFloat(rule.priceModifier),
      appliedCount: rule.timesApplied,
      revenueImpact: rule.totalRevenueImpactCents ? rule.totalRevenueImpactCents / 100 : 0,
    }));
    
    return NextResponse.json({
      rules: formattedRules,
      total: formattedRules.length,
    });
    
  } catch (error) {
    console.error("Error fetching pricing rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing rules" },
      { status: 500 }
    );
  }
}

// POST - Create new pricing rule
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
      
      const parseResult = createRuleSchema.safeParse(body);
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
      
      // Verify service ownership if serviceId provided
      if (data.serviceId) {
        const service = await db.select({ id: servicesTable.id })
          .from(servicesTable)
          .where(and(
            eq(servicesTable.id, data.serviceId),
            eq(servicesTable.providerId, data.providerId)
          ))
          .limit(1);
        
        if (!service.length) {
          return NextResponse.json(
            { error: "Service not found or doesn't belong to provider" },
            { status: 404 }
          );
        }
      }
      
      // Validate rule conditions based on type
      const validationResult = validateRuleConditions(data.ruleType, data.conditions);
      if (!validationResult.isValid) {
        return NextResponse.json(
          { error: "Invalid rule conditions", details: validationResult.errors },
          { status: 400 }
        );
      }
      
      // Create the rule
      const newRule: NewPricingRule = {
        providerId: data.providerId,
        serviceId: data.serviceId || null,
        ruleType: data.ruleType,
        name: data.name,
        description: data.description,
        conditions: data.conditions,
        priceModifier: data.priceModifier.toString(),
        fixedAdjustmentCents: data.fixedAdjustmentCents,
        maxPriceCents: data.maxPriceCents,
        minPriceCents: data.minPriceCents,
        priority: data.priority,
        isStackable: data.isStackable,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive,
        isAutomatic: data.isAutomatic,
        metadata: data.metadata,
      };
      
      const [createdRule] = await db.insert(pricingRulesTable)
        .values(newRule)
        .returning();
      
      return NextResponse.json({
        success: true,
        rule: {
          ...createdRule,
          priceModifier: parseFloat(createdRule.priceModifier),
        },
      });
      
    } catch (error) {
      console.error("Error creating pricing rule:", error);
      return NextResponse.json(
        { error: "Failed to create pricing rule" },
        { status: 500 }
      );
    }
  }
);

// PUT - Update existing pricing rule
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
      
      const parseResult = updateRuleSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: parseResult.error.errors },
          { status: 400 }
        );
      }
      
      const { id, ...updateData } = parseResult.data;
      
      // Get existing rule and verify ownership
      const existingRule = await db.select({
        rule: pricingRulesTable,
        userId: providersTable.userId,
      })
      .from(pricingRulesTable)
      .innerJoin(providersTable, eq(pricingRulesTable.providerId, providersTable.id))
      .where(eq(pricingRulesTable.id, id))
      .limit(1);
      
      if (!existingRule.length || existingRule[0].userId !== userId) {
        return NextResponse.json(
          { error: "Rule not found or unauthorized" },
          { status: 403 }
        );
      }
      
      // Validate conditions if being updated
      if (updateData.conditions && updateData.ruleType) {
        const validationResult = validateRuleConditions(
          updateData.ruleType,
          updateData.conditions
        );
        if (!validationResult.isValid) {
          return NextResponse.json(
            { error: "Invalid rule conditions", details: validationResult.errors },
            { status: 400 }
          );
        }
      }
      
      // Build update object
      const updates: any = {
        updatedAt: new Date(),
      };
      
      if (updateData.name !== undefined) updates.name = updateData.name;
      if (updateData.description !== undefined) updates.description = updateData.description;
      if (updateData.conditions !== undefined) updates.conditions = updateData.conditions;
      if (updateData.priceModifier !== undefined) updates.priceModifier = updateData.priceModifier.toString();
      if (updateData.fixedAdjustmentCents !== undefined) updates.fixedAdjustmentCents = updateData.fixedAdjustmentCents;
      if (updateData.maxPriceCents !== undefined) updates.maxPriceCents = updateData.maxPriceCents;
      if (updateData.minPriceCents !== undefined) updates.minPriceCents = updateData.minPriceCents;
      if (updateData.priority !== undefined) updates.priority = updateData.priority;
      if (updateData.isStackable !== undefined) updates.isStackable = updateData.isStackable;
      if (updateData.validFrom !== undefined) updates.validFrom = updateData.validFrom ? new Date(updateData.validFrom) : null;
      if (updateData.validUntil !== undefined) updates.validUntil = updateData.validUntil ? new Date(updateData.validUntil) : null;
      if (updateData.isActive !== undefined) updates.isActive = updateData.isActive;
      if (updateData.isAutomatic !== undefined) updates.isAutomatic = updateData.isAutomatic;
      if (updateData.metadata !== undefined) updates.metadata = updateData.metadata;
      
      const [updatedRule] = await db.update(pricingRulesTable)
        .set(updates)
        .where(eq(pricingRulesTable.id, id))
        .returning();
      
      return NextResponse.json({
        success: true,
        rule: {
          ...updatedRule,
          priceModifier: parseFloat(updatedRule.priceModifier),
        },
      });
      
    } catch (error) {
      console.error("Error updating pricing rule:", error);
      return NextResponse.json(
        { error: "Failed to update pricing rule" },
        { status: 500 }
      );
    }
  }
);

// DELETE - Delete pricing rule
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
      const params = Object.fromEntries(searchParams.entries());
      
      const parseResult = deleteRuleSchema.safeParse(params);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid parameters", details: parseResult.error.errors },
          { status: 400 }
        );
      }
      
      const { id, providerId } = parseResult.data;
      
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
      
      // Delete the rule
      const deletedRule = await db.delete(pricingRulesTable)
        .where(and(
          eq(pricingRulesTable.id, id),
          eq(pricingRulesTable.providerId, providerId)
        ))
        .returning();
      
      if (!deletedRule.length) {
        return NextResponse.json(
          { error: "Rule not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: "Pricing rule deleted successfully",
      });
      
    } catch (error) {
      console.error("Error deleting pricing rule:", error);
      return NextResponse.json(
        { error: "Failed to delete pricing rule" },
        { status: 500 }
      );
    }
  }
);

// Helper function to validate rule conditions
function validateRuleConditions(
  ruleType: string,
  conditions: any
): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  switch (ruleType) {
    case 'time_based':
      if (conditions.days_of_week) {
        if (!Array.isArray(conditions.days_of_week)) {
          errors.push("days_of_week must be an array");
        } else {
          const invalidDays = conditions.days_of_week.filter(
            (d: any) => typeof d !== 'number' || d < 0 || d > 6
          );
          if (invalidDays.length > 0) {
            errors.push("days_of_week must contain numbers 0-6");
          }
        }
      }
      
      if (conditions.hours) {
        if (!Array.isArray(conditions.hours)) {
          errors.push("hours must be an array of hour ranges");
        } else {
          conditions.hours.forEach((range: any, i: number) => {
            if (!Array.isArray(range) || range.length !== 2) {
              errors.push(`hours[${i}] must be a tuple of [start, end]`);
            } else {
              const [start, end] = range;
              if (typeof start !== 'number' || start < 0 || start > 23) {
                errors.push(`hours[${i}][0] must be 0-23`);
              }
              if (typeof end !== 'number' || end < 0 || end > 23) {
                errors.push(`hours[${i}][1] must be 0-23`);
              }
            }
          });
        }
      }
      break;
    
    case 'demand_based':
      if (!conditions.demand_threshold) {
        errors.push("demand_threshold is required");
      } else if (!["very_low", "low", "normal", "high", "very_high", "extreme"].includes(conditions.demand_threshold)) {
        errors.push("Invalid demand_threshold value");
      }
      break;
    
    case 'seasonal':
      if (!conditions.dates && !conditions.date_ranges) {
        errors.push("Either dates or date_ranges must be provided");
      }
      
      if (conditions.dates && !Array.isArray(conditions.dates)) {
        errors.push("dates must be an array");
      }
      
      if (conditions.date_ranges) {
        if (!Array.isArray(conditions.date_ranges)) {
          errors.push("date_ranges must be an array");
        } else {
          conditions.date_ranges.forEach((range: any, i: number) => {
            if (!Array.isArray(range) || range.length !== 2) {
              errors.push(`date_ranges[${i}] must be a tuple of [start_date, end_date]`);
            }
          });
        }
      }
      break;
    
    case 'advance_booking':
      if (!conditions.min_hours && !conditions.max_hours) {
        errors.push("Either min_hours or max_hours must be provided");
      }
      
      if (conditions.min_hours && (typeof conditions.min_hours !== 'number' || conditions.min_hours < 0)) {
        errors.push("min_hours must be a positive number");
      }
      
      if (conditions.max_hours && (typeof conditions.max_hours !== 'number' || conditions.max_hours < 0)) {
        errors.push("max_hours must be a positive number");
      }
      
      if (conditions.min_hours && conditions.max_hours && conditions.min_hours > conditions.max_hours) {
        errors.push("min_hours cannot be greater than max_hours");
      }
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}