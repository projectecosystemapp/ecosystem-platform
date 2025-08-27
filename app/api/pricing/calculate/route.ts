// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  pricingRulesTable, 
  demandMetricsTable,
  surgePricingEventsTable,
  priceHistoryTable,
  type PricingRule,
  type SurgePricingEvent,
  type NewPriceHistory
} from "@/db/schema/pricing-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { and, eq, gte, lte, or, sql, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * Dynamic Pricing Calculation Engine
 * POST /api/pricing/calculate - Calculate dynamic price for a service
 */

// Request validation schema
const calculatePriceSchema = z.object({
  serviceId: z.string().uuid(),
  providerId: z.string().uuid(),
  requestedDate: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(), // in minutes
  groupSize: z.number().int().positive().default(1),
  customerId: z.string().optional(),
  includeBreakdown: z.boolean().default(false),
});

// Rule condition validation schemas
const timeBasedConditionsSchema = z.object({
  days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  hours: z.array(z.tuple([z.number().int().min(0).max(23), z.number().int().min(0).max(23)])).optional(),
  timezone: z.string().default("UTC"),
});

const demandBasedConditionsSchema = z.object({
  demand_threshold: z.enum(["very_low", "low", "normal", "high", "very_high", "extreme"]),
  min_bookings: z.number().int().optional(),
  time_window_hours: z.number().positive().optional(),
});

const seasonalConditionsSchema = z.object({
  dates: z.array(z.string()).optional(),
  date_ranges: z.array(z.tuple([z.string(), z.string()])).optional(),
});

const advanceBookingConditionsSchema = z.object({
  min_hours: z.number().positive().optional(),
  max_hours: z.number().positive().optional(),
});

interface PriceModifier {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  modifier: number;
  adjustmentCents?: number;
  priority: number;
}

interface PriceCalculation {
  basePrice: number;
  finalPrice: number;
  currency: string;
  modifiers: PriceModifier[];
  surgeActive: boolean;
  surgeMultiplier?: number;
  demandLevel?: string;
  totalModifier: number;
  savingsAmount?: number;
  savingsPercent?: number;
}

export const POST = withRateLimit(
  'api',
  async (req: NextRequest) => {
    try {
      const { userId } = auth();
      const body = await req.json();
      
      // Validate request
      const parseResult = calculatePriceSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: parseResult.error.errors },
          { status: 400 }
        );
      }
      
      const { 
        serviceId, 
        providerId, 
        requestedDate, 
        duration, 
        groupSize,
        customerId,
        includeBreakdown 
      } = parseResult.data;
      
      // Get service base price
      const service = await db.select({
        id: servicesTable.id,
        basePrice: servicesTable.basePrice,
        priceType: servicesTable.priceType,
        minimumDuration: servicesTable.minimumDuration,
      })
      .from(servicesTable)
      .where(and(
        eq(servicesTable.id, serviceId),
        eq(servicesTable.providerId, providerId)
      ))
      .limit(1);
      
      if (!service.length) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 404 }
        );
      }
      
      const baseService = service[0];
      let basePrice = parseFloat(baseService.basePrice);
      
      // Adjust base price for duration if hourly pricing
      if (baseService.priceType === 'hourly' && duration) {
        const hours = duration / 60;
        basePrice = basePrice * hours;
      }
      
      // Adjust for group size
      basePrice = basePrice * groupSize;
      
      const targetDate = requestedDate ? new Date(requestedDate) : new Date();
      const dayOfWeek = targetDate.getDay();
      const hour = targetDate.getHours();
      
      // Get applicable pricing rules
      const rules = await db.select()
        .from(pricingRulesTable)
        .where(and(
          eq(pricingRulesTable.providerId, providerId),
          eq(pricingRulesTable.isActive, true),
          or(
            eq(pricingRulesTable.serviceId, serviceId),
            sql`${pricingRulesTable.serviceId} IS NULL`
          ),
          or(
            sql`${pricingRulesTable.validFrom} IS NULL`,
            lte(pricingRulesTable.validFrom, targetDate)
          ),
          or(
            sql`${pricingRulesTable.validUntil} IS NULL`,
            gte(pricingRulesTable.validUntil, targetDate)
          )
        ))
        .orderBy(desc(pricingRulesTable.priority));
      
      // Check for active surge pricing
      const surgePricing = await db.select()
        .from(surgePricingEventsTable)
        .where(and(
          eq(surgePricingEventsTable.providerId, providerId),
          eq(surgePricingEventsTable.isActive, true),
          lte(surgePricingEventsTable.startTime, targetDate),
          gte(surgePricingEventsTable.endTime, targetDate)
        ))
        .limit(1);
      
      // Get current demand metrics
      const demandMetrics = await db.select()
        .from(demandMetricsTable)
        .where(and(
          eq(demandMetricsTable.providerId, providerId),
          eq(demandMetricsTable.serviceId, serviceId),
          eq(demandMetricsTable.date, targetDate.toISOString().split('T')[0]),
          eq(demandMetricsTable.hour, hour)
        ))
        .limit(1);
      
      // Apply pricing rules
      const appliedModifiers: PriceModifier[] = [];
      let totalModifier = 1.0;
      let totalFixedAdjustment = 0;
      
      for (const rule of rules) {
        if (!isRuleApplicable(rule, targetDate, dayOfWeek, hour, demandMetrics[0])) {
          continue;
        }
        
        const modifier: PriceModifier = {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.ruleType,
          modifier: parseFloat(rule.priceModifier),
          adjustmentCents: rule.fixedAdjustmentCents || undefined,
          priority: rule.priority,
        };
        
        appliedModifiers.push(modifier);
        
        // Apply modifiers based on stackability
        if (rule.isStackable || appliedModifiers.length === 1) {
          if (rule.fixedAdjustmentCents) {
            totalFixedAdjustment += rule.fixedAdjustmentCents;
          } else {
            totalModifier *= parseFloat(rule.priceModifier);
          }
        }
      }
      
      // Apply surge pricing if active
      if (surgePricing.length > 0) {
        const surge = surgePricing[0];
        const surgeServices = surge.affectedServices as string[] || [];
        
        if (surgeServices.length === 0 || surgeServices.includes(serviceId)) {
          totalModifier *= parseFloat(surge.surgeMultiplier);
          appliedModifiers.push({
            ruleId: surge.id,
            ruleName: surge.eventName || 'Surge Pricing',
            ruleType: 'surge',
            modifier: parseFloat(surge.surgeMultiplier),
            priority: 999, // Surge always has highest priority
          });
        }
      }
      
      // Calculate final price
      let finalPrice = (basePrice * totalModifier) + (totalFixedAdjustment / 100);
      
      // Apply min/max constraints from rules
      for (const rule of rules) {
        if (rule.maxPriceCents && finalPrice * 100 > rule.maxPriceCents) {
          finalPrice = rule.maxPriceCents / 100;
        }
        if (rule.minPriceCents && finalPrice * 100 < rule.minPriceCents) {
          finalPrice = rule.minPriceCents / 100;
        }
      }
      
      // Round to 2 decimal places
      finalPrice = Math.round(finalPrice * 100) / 100;
      
      // Save price history
      if (userId || customerId) {
        const priceHistory: NewPriceHistory = {
          serviceId,
          oldPriceCents: Math.round(basePrice * 100),
          newPriceCents: Math.round(finalPrice * 100),
          changePercent: ((finalPrice - basePrice) / basePrice * 100).toString(),
          appliedRules: appliedModifiers.map(m => ({
            ruleId: m.ruleId,
            ruleName: m.ruleName,
            modifier: m.modifier,
          })),
          finalModifier: totalModifier.toString(),
          demandLevel: demandMetrics[0]?.demandLevel || 'normal',
          changeReason: appliedModifiers.length > 0 ? 'Dynamic pricing applied' : 'Base price',
          changedBy: 'system',
          effectiveFrom: targetDate,
        };
        
        await db.insert(priceHistoryTable).values(priceHistory);
      }
      
      // Update rule application counts
      if (appliedModifiers.length > 0) {
        for (const modifier of appliedModifiers) {
          await db.update(pricingRulesTable)
            .set({
              timesApplied: sql`${pricingRulesTable.timesApplied} + 1`,
              totalRevenueImpactCents: sql`${pricingRulesTable.totalRevenueImpactCents} + ${Math.round((finalPrice - basePrice) * 100)}`,
              updatedAt: new Date(),
            })
            .where(eq(pricingRulesTable.id, modifier.ruleId));
        }
      }
      
      // Calculate savings if applicable
      let savingsAmount: number | undefined;
      let savingsPercent: number | undefined;
      
      if (finalPrice < basePrice) {
        savingsAmount = basePrice - finalPrice;
        savingsPercent = (savingsAmount / basePrice) * 100;
      }
      
      const response: PriceCalculation = {
        basePrice,
        finalPrice,
        currency: 'USD',
        modifiers: includeBreakdown ? appliedModifiers : [],
        surgeActive: surgePricing.length > 0,
        surgeMultiplier: surgePricing[0] ? parseFloat(surgePricing[0].surgeMultiplier) : undefined,
        demandLevel: demandMetrics[0]?.demandLevel,
        totalModifier,
        savingsAmount,
        savingsPercent,
      };
      
      return NextResponse.json(response);
      
    } catch (error) {
      console.error("Error calculating price:", error);
      return NextResponse.json(
        { error: "Failed to calculate price" },
        { status: 500 }
      );
    }
  }
);

// Helper function to check if a rule is applicable
function isRuleApplicable(
  rule: PricingRule,
  targetDate: Date,
  dayOfWeek: number,
  hour: number,
  demandMetrics?: any
): boolean {
  const conditions = rule.conditions as any;
  
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // No conditions means always applicable
  }
  
  switch (rule.ruleType) {
    case 'time_based': {
      const timeConditions = timeBasedConditionsSchema.safeParse(conditions);
      if (!timeConditions.success) return false;
      
      const { days_of_week, hours } = timeConditions.data;
      
      // Check day of week
      if (days_of_week && !days_of_week.includes(dayOfWeek)) {
        return false;
      }
      
      // Check hour ranges
      if (hours) {
        const isInTimeRange = hours.some(([start, end]) => {
          if (start <= end) {
            return hour >= start && hour <= end;
          } else {
            // Handle overnight ranges (e.g., 22:00 - 02:00)
            return hour >= start || hour <= end;
          }
        });
        if (!isInTimeRange) return false;
      }
      
      return true;
    }
    
    case 'demand_based': {
      const demandConditions = demandBasedConditionsSchema.safeParse(conditions);
      if (!demandConditions.success) return false;
      
      if (!demandMetrics) return false;
      
      const { demand_threshold } = demandConditions.data;
      const demandLevels = ["very_low", "low", "normal", "high", "very_high", "extreme"];
      const thresholdIndex = demandLevels.indexOf(demand_threshold);
      const currentIndex = demandLevels.indexOf(demandMetrics.demandLevel);
      
      return currentIndex >= thresholdIndex;
    }
    
    case 'seasonal': {
      const seasonalConditions = seasonalConditionsSchema.safeParse(conditions);
      if (!seasonalConditions.success) return false;
      
      const { dates, date_ranges } = seasonalConditions.data;
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      // Check specific dates
      if (dates && dates.includes(targetDateStr)) {
        return true;
      }
      
      // Check date ranges
      if (date_ranges) {
        return date_ranges.some(([start, end]) => {
          return targetDateStr >= start && targetDateStr <= end;
        });
      }
      
      return false;
    }
    
    case 'advance_booking': {
      const advanceConditions = advanceBookingConditionsSchema.safeParse(conditions);
      if (!advanceConditions.success) return false;
      
      const { min_hours, max_hours } = advanceConditions.data;
      const hoursInAdvance = (targetDate.getTime() - Date.now()) / (1000 * 60 * 60);
      
      if (min_hours && hoursInAdvance < min_hours) return false;
      if (max_hours && hoursInAdvance > max_hours) return false;
      
      return true;
    }
    
    default:
      return true;
  }
}