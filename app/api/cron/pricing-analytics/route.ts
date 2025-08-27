// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/db";
import { 
  demandMetricsTable,
  pricingRulesTable,
  surgePricingEventsTable,
  priceHistoryTable,
  competitorPricingTable,
  priceAlertsTable,
  type NewDemandMetric,
  type NewSurgePricingEvent,
  type NewPriceHistory
} from "@/db/schema/pricing-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, gte, lte, sql, desc, asc, inArray, between } from "drizzle-orm";

/**
 * Cron job endpoint for pricing analytics and optimization
 * Calculates demand metrics, triggers surge pricing, updates competitor data, and generates insights
 * 
 * Schedule recommendation: Run every 2 hours during business hours
 * Cron expression: 0 6-22/2 * * *
 */
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = headers().get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron job not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const startTime = new Date();
    console.log(`[CRON] Starting pricing analytics at ${startTime.toISOString()}`);
    
    // Calculate demand metrics for the past hour
    const demandResults = await calculateDemandMetrics();
    
    // Evaluate and trigger surge pricing
    const surgeResults = await evaluateSurgePricing();
    
    // Update competitor pricing data
    const competitorResults = await updateCompetitorPricing();
    
    // Process price alerts
    const alertResults = await processPriceAlerts();
    
    // Generate pricing insights and recommendations
    const insightResults = await generatePricingInsights();
    
    // Clean up old metrics (older than 90 days)
    const cleanupResults = await cleanupOldMetrics();
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Compile results
    const result = {
      success: true,
      timestamp: startTime.toISOString(),
      duration: `${duration}ms`,
      demandMetrics: demandResults,
      surgePricing: surgeResults,
      competitorData: competitorResults,
      alerts: alertResults,
      insights: insightResults,
      cleanup: cleanupResults,
      nextRun: getNextRunTime(),
    };
    
    console.log(`[CRON] Pricing analytics completed:`, result);

    // Log metrics for monitoring
    await logPricingMetrics(result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Pricing analytics cron job error:", error);
    
    // Send alert to admin
    await notifyAdminOfCronFailure("pricing-analytics", error);
    
    return NextResponse.json(
      { 
        error: "Pricing analytics cron job failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Calculate demand metrics for recent activity
async function calculateDemandMetrics() {
  let metricsCreated = 0;
  let providersAnalyzed = 0;
  
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Get all active providers
    const activeProviders = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.isActive, true));
    
    for (const provider of activeProviders) {
      providersAnalyzed++;
      
      // Get provider's services
      const services = await db
        .select()
        .from(servicesTable)
        .where(eq(servicesTable.providerId, provider.id));
      
      for (const service of services) {
        // Calculate bookings in the last hour
        const bookingsCount = await db
          .select({
            count: sql<number>`COUNT(*)`
          })
          .from(bookingsTable)
          .where(
            and(
              eq(bookingsTable.serviceId, service.id),
              gte(bookingsTable.createdAt, oneHourAgo),
              lte(bookingsTable.createdAt, now)
            )
          );
        
        // Calculate searches/views (if tracked in separate table)
        // For now, we'll simulate based on booking patterns
        const searches = Math.round((bookingsCount[0]?.count || 0) * 5); // 5:1 ratio
        const views = Math.round((bookingsCount[0]?.count || 0) * 3); // 3:1 ratio
        const inquiries = Math.round((bookingsCount[0]?.count || 0) * 1.5); // 1.5:1 ratio
        
        // Calculate utilization rate
        const availableSlots = await calculateAvailableSlots(service.id, oneHourAgo, now);
        const totalSlots = availableSlots + (bookingsCount[0]?.count || 0);
        const utilizationRate = totalSlots > 0 ? (bookingsCount[0]?.count || 0) / totalSlots : 0;
        
        // Calculate conversion rates
        const searchToBookingRate = searches > 0 ? (bookingsCount[0]?.count || 0) / searches : 0;
        const viewToBookingRate = views > 0 ? (bookingsCount[0]?.count || 0) / views : 0;
        
        // Calculate average pricing
        const pricingStats = await db
          .select({
            avg: sql<number>`AVG(${bookingsTable.totalAmountCents})`,
            min: sql<number>`MIN(${bookingsTable.totalAmountCents})`,
            max: sql<number>`MAX(${bookingsTable.totalAmountCents})`
          })
          .from(bookingsTable)
          .where(
            and(
              eq(bookingsTable.serviceId, service.id),
              gte(bookingsTable.createdAt, oneHourAgo),
              lte(bookingsTable.createdAt, now)
            )
          );
        
        // Calculate demand level and score
        const { demandLevel, demandScore } = calculateDemandLevel(
          bookingsCount[0]?.count || 0,
          utilizationRate,
          searchToBookingRate,
          viewToBookingRate
        );
        
        // Get competitor average (if available)
        const competitorAvg = await db
          .select({
            avg: sql<number>`AVG(${competitorPricingTable.priceCents})`
          })
          .from(competitorPricingTable)
          .where(
            and(
              eq(competitorPricingTable.category, service.category),
              gte(competitorPricingTable.observedAt, oneHourAgo)
            )
          );
        
        // Create demand metric record
        const demandMetric: NewDemandMetric = {
          providerId: provider.id,
          serviceId: service.id,
          date: today,
          hour: currentHour,
          dayOfWeek,
          bookingsCount: bookingsCount[0]?.count || 0,
          searchesCount: searches,
          viewsCount: views,
          inquiriesCount: inquiries,
          availableSlots,
          totalSlots,
          utilizationRate: utilizationRate.toString(),
          searchToBookingRate: searchToBookingRate.toString(),
          viewToBookingRate: viewToBookingRate.toString(),
          avgPriceCents: Math.round(pricingStats[0]?.avg || service.basePriceCents),
          minPriceCents: Math.round(pricingStats[0]?.min || service.basePriceCents),
          maxPriceCents: Math.round(pricingStats[0]?.max || service.basePriceCents),
          demandLevel,
          demandScore: demandScore.toString(),
          competitorAvgPriceCents: Math.round(competitorAvg[0]?.avg || 0),
          marketShareEstimate: calculateMarketShare(bookingsCount[0]?.count || 0, competitorAvg[0]?.avg || 0),
        };
        
        await db.insert(demandMetricsTable).values(demandMetric);
        metricsCreated++;
      }
    }
    
  } catch (error) {
    console.error("Error calculating demand metrics:", error);
  }
  
  return { metricsCreated, providersAnalyzed };
}

// Evaluate and trigger automatic surge pricing
async function evaluateSurgePricing() {
  let surgeTriggered = 0;
  let surgeEnded = 0;
  
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get recent demand metrics indicating high demand
    const highDemandServices = await db
      .select({
        metric: demandMetricsTable,
        service: servicesTable,
        provider: providersTable
      })
      .from(demandMetricsTable)
      .innerJoin(servicesTable, eq(demandMetricsTable.serviceId, servicesTable.id))
      .innerJoin(providersTable, eq(demandMetricsTable.providerId, providersTable.id))
      .where(
        and(
          gte(demandMetricsTable.calculatedAt, oneHourAgo),
          inArray(demandMetricsTable.demandLevel, ["high", "very_high", "extreme"]),
          eq(providersTable.isActive, true)
        )
      )
      .orderBy(desc(demandMetricsTable.demandScore));
    
    for (const { metric, service, provider } of highDemandServices) {
      // Check if surge pricing is already active
      const activeSurge = await db
        .select()
        .from(surgePricingEventsTable)
        .where(
          and(
            eq(surgePricingEventsTable.providerId, provider.id),
            eq(surgePricingEventsTable.isActive, true),
            sql`${surgePricingEventsTable.affectedServices} @> ${JSON.stringify([service.id])}`
          )
        );
      
      if (activeSurge.length === 0) {
        // Check provider's surge pricing rules
        const surgeRules = await db
          .select()
          .from(pricingRulesTable)
          .where(
            and(
              eq(pricingRulesTable.providerId, provider.id),
              eq(pricingRulesTable.ruleType, "demand_based"),
              eq(pricingRulesTable.isActive, true),
              eq(pricingRulesTable.isAutomatic, true)
            )
          );
        
        for (const rule of surgeRules) {
          const conditions = rule.conditions as any;
          const demandScore = parseFloat(metric.demandScore || "0");
          const utilizationRate = parseFloat(metric.utilizationRate || "0");
          
          // Check if conditions are met
          if (demandScore >= (conditions.min_demand_score || 7) &&
              utilizationRate >= (conditions.min_utilization || 0.8)) {
            
            // Calculate surge multiplier
            const surgeMultiplier = Math.min(
              parseFloat(rule.priceModifier.toString()),
              3.0 // Max 3x surge
            );
            
            // Create surge pricing event
            const surgeEvent: NewSurgePricingEvent = {
              providerId: provider.id,
              eventName: `Auto-surge for ${service.name}`,
              eventType: "automatic",
              startTime: now,
              endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours
              surgeMultiplier: surgeMultiplier.toString(),
              demandScore: demandScore.toString(),
              affectedServices: [service.id],
              isActive: true,
              wasAutoTriggered: true,
              triggerReason: `High demand: ${metric.demandLevel} (score: ${demandScore})`,
              metadata: {
                ruleId: rule.id,
                utilizationRate,
                bookingsInHour: metric.bookingsCount
              }
            };
            
            await db.insert(surgePricingEventsTable).values(surgeEvent);
            
            // Create price history record
            const originalPrice = service.basePriceCents;
            const newPrice = Math.round(originalPrice * surgeMultiplier);
            
            const priceHistory: NewPriceHistory = {
              serviceId: service.id,
              oldPriceCents: originalPrice,
              newPriceCents: newPrice,
              changePercent: ((surgeMultiplier - 1) * 100).toString(),
              appliedRules: [{ ruleId: rule.id, modifier: surgeMultiplier }],
              finalModifier: surgeMultiplier.toString(),
              demandLevel: metric.demandLevel,
              changeReason: "Automatic surge pricing triggered",
              changedBy: "system",
              effectiveFrom: now,
              effectiveUntil: new Date(now.getTime() + 2 * 60 * 60 * 1000)
            };
            
            await db.insert(priceHistoryTable).values(priceHistory);
            
            surgeTriggered++;
            
            // Notify provider
            await notifyProviderOfSurge(provider.id, service.name, surgeMultiplier);
            
            break; // Only apply first matching rule
          }
        }
      }
    }
    
    // End surge pricing events where demand has normalized
    const activeSurgeEvents = await db
      .select()
      .from(surgePricingEventsTable)
      .where(eq(surgePricingEventsTable.isActive, true));
    
    for (const surgeEvent of activeSurgeEvents) {
      // Check if event has expired or demand normalized
      if (now > surgeEvent.endTime) {
        await db.update(surgePricingEventsTable)
          .set({
            isActive: false,
            metadata: {
              ...(surgeEvent.metadata as any),
              endedAt: now.toISOString(),
              endReason: "Time expired"
            }
          })
          .where(eq(surgePricingEventsTable.id, surgeEvent.id));
        
        surgeEnded++;
      } else {
        // Check current demand for affected services
        const affectedServices = surgeEvent.affectedServices as string[];
        
        if (affectedServices && affectedServices.length > 0) {
          const currentDemand = await db
            .select()
            .from(demandMetricsTable)
            .where(
              and(
                inArray(demandMetricsTable.serviceId, affectedServices),
                gte(demandMetricsTable.calculatedAt, oneHourAgo)
              )
            )
            .orderBy(desc(demandMetricsTable.calculatedAt))
            .limit(1);
          
          if (currentDemand.length > 0) {
            const currentDemandLevel = currentDemand[0].demandLevel;
            
            if (currentDemandLevel === "normal" || currentDemandLevel === "low" || currentDemandLevel === "very_low") {
              await db.update(surgePricingEventsTable)
                .set({
                  isActive: false,
                  metadata: {
                    ...(surgeEvent.metadata as any),
                    endedAt: now.toISOString(),
                    endReason: "Demand normalized"
                  }
                })
                .where(eq(surgePricingEventsTable.id, surgeEvent.id));
              
              surgeEnded++;
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error("Error evaluating surge pricing:", error);
  }
  
  return { surgeTriggered, surgeEnded };
}

// Update competitor pricing data
async function updateCompetitorPricing() {
  let updatesReceived = 0;
  
  try {
    // In a real implementation, this would:
    // 1. Call external APIs to scrape competitor pricing
    // 2. Process uploaded competitor data files
    // 3. Update existing records with new prices
    
    // For now, simulate with placeholder logic
    const categories = ["cleaning", "handyman", "beauty", "fitness", "tutoring"];
    const locations = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"];
    
    for (const category of categories) {
      for (const location of locations) {
        // Simulate receiving competitor data
        const competitorData = generateMockCompetitorData(category, location);
        
        if (competitorData) {
          await db.insert(competitorPricingTable).values(competitorData);
          updatesReceived++;
        }
      }
    }
    
  } catch (error) {
    console.error("Error updating competitor pricing:", error);
  }
  
  return { updatesReceived };
}

// Process price alerts for customers
async function processPriceAlerts() {
  let alertsTriggered = 0;
  
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get active price alerts
    const activeAlerts = await db
      .select({
        alert: priceAlertsTable,
        service: servicesTable,
        provider: providersTable
      })
      .from(priceAlertsTable)
      .leftJoin(servicesTable, eq(priceAlertsTable.serviceId, servicesTable.id))
      .leftJoin(providersTable, eq(priceAlertsTable.providerId, providersTable.id))
      .where(
        and(
          eq(priceAlertsTable.isActive, true),
          eq(priceAlertsTable.isPaused, false),
          // Don't trigger if recently triggered (cooldown)
          sql`(${priceAlertsTable.lastTriggeredAt} IS NULL OR ${priceAlertsTable.lastTriggeredAt} < ${twentyFourHoursAgo})`
        )
      );
    
    for (const { alert, service, provider } of activeAlerts) {
      let shouldTrigger = false;
      let triggerReason = "";
      
      if (alert.alertType === "below_price" && service && alert.targetPriceCents) {
        if (service.basePriceCents <= alert.targetPriceCents) {
          shouldTrigger = true;
          triggerReason = `Price dropped to $${(service.basePriceCents / 100).toFixed(2)}`;
        }
      }
      
      if (alert.alertType === "percentage_drop" && service && alert.percentageDrop) {
        // Check recent price history for drops
        const recentPriceChanges = await db
          .select()
          .from(priceHistoryTable)
          .where(
            and(
              eq(priceHistoryTable.serviceId, service.id),
              gte(priceHistoryTable.createdAt, twentyFourHoursAgo)
            )
          );
        
        for (const change of recentPriceChanges) {
          const percentChange = parseFloat(change.changePercent || "0");
          if (Math.abs(percentChange) >= alert.percentageDrop) {
            shouldTrigger = true;
            triggerReason = `Price dropped by ${Math.abs(percentChange).toFixed(1)}%`;
            break;
          }
        }
      }
      
      if (shouldTrigger) {
        // Check trigger limits
        if (alert.maxTriggers && alert.triggerCount >= alert.maxTriggers) {
          continue; // Skip if max triggers reached
        }
        
        // Update alert
        await db.update(priceAlertsTable)
          .set({
            lastTriggeredAt: now,
            triggerCount: alert.triggerCount + 1
          })
          .where(eq(priceAlertsTable.id, alert.id));
        
        // Send notification
        await sendPriceAlertNotification(
          alert.customerId,
          triggerReason,
          service?.name || provider?.businessName || "Service",
          service?.basePriceCents || 0
        );
        
        alertsTriggered++;
      }
    }
    
  } catch (error) {
    console.error("Error processing price alerts:", error);
  }
  
  return { alertsTriggered };
}

// Generate pricing insights and recommendations
async function generatePricingInsights() {
  let insightsGenerated = 0;
  
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Analyze pricing performance by provider
    const providerPerformance = await db
      .select({
        providerId: demandMetricsTable.providerId,
        avgDemandScore: sql<number>`AVG(CAST(${demandMetricsTable.demandScore} AS DECIMAL))`,
        avgUtilization: sql<number>`AVG(CAST(${demandMetricsTable.utilizationRate} AS DECIMAL))`,
        totalBookings: sql<number>`SUM(${demandMetricsTable.bookingsCount})`,
        avgPrice: sql<number>`AVG(${demandMetricsTable.avgPriceCents})`
      })
      .from(demandMetricsTable)
      .where(gte(demandMetricsTable.calculatedAt, sevenDaysAgo))
      .groupBy(demandMetricsTable.providerId)
      .having(sql`SUM(${demandMetricsTable.bookingsCount}) > 0`);
    
    for (const performance of providerPerformance) {
      const insights = [];
      
      // Low utilization insight
      if (performance.avgUtilization < 0.5) {
        insights.push({
          type: "low_utilization",
          message: "Consider lowering prices to increase demand",
          currentUtilization: performance.avgUtilization,
          recommendedPriceChange: -0.1 // 10% decrease
        });
      }
      
      // High demand, high utilization
      if (performance.avgDemandScore > 7 && performance.avgUtilization > 0.8) {
        insights.push({
          type: "high_demand",
          message: "Consider raising prices due to high demand",
          currentDemandScore: performance.avgDemandScore,
          recommendedPriceChange: 0.15 // 15% increase
        });
      }
      
      // Competitor comparison
      const competitorAvg = await getCompetitorAveragePrice(performance.providerId);
      if (competitorAvg && performance.avgPrice < competitorAvg * 0.8) {
        insights.push({
          type: "underpriced",
          message: "Your prices are significantly below market average",
          yourPrice: performance.avgPrice,
          marketAverage: competitorAvg,
          recommendedPriceChange: 0.2 // 20% increase
        });
      }
      
      if (insights.length > 0) {
        // Store insights (you might have a dedicated insights table)
        console.log(`Generated ${insights.length} insights for provider ${performance.providerId}`);
        
        // Notify provider of insights
        await notifyProviderOfInsights(performance.providerId, insights);
        
        insightsGenerated += insights.length;
      }
    }
    
  } catch (error) {
    console.error("Error generating pricing insights:", error);
  }
  
  return { insightsGenerated };
}

// Clean up old metrics data
async function cleanupOldMetrics() {
  let recordsDeleted = 0;
  
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // Delete old demand metrics
    const deletedMetrics = await db
      .delete(demandMetricsTable)
      .where(lte(demandMetricsTable.calculatedAt, ninetyDaysAgo))
      .returning();
    
    recordsDeleted += deletedMetrics.length;
    
    // Delete old inactive surge events
    const deletedSurgeEvents = await db
      .delete(surgePricingEventsTable)
      .where(
        and(
          eq(surgePricingEventsTable.isActive, false),
          lte(surgePricingEventsTable.startTime, ninetyDaysAgo)
        )
      )
      .returning();
    
    recordsDeleted += deletedSurgeEvents.length;
    
    // Clean up old competitor pricing data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const deletedCompetitorData = await db
      .delete(competitorPricingTable)
      .where(lte(competitorPricingTable.observedAt, sixMonthsAgo))
      .returning();
    
    recordsDeleted += deletedCompetitorData.length;
    
  } catch (error) {
    console.error("Error cleaning up old metrics:", error);
  }
  
  return { recordsDeleted };
}

// Helper functions
async function calculateAvailableSlots(serviceId: string, startTime: Date, endTime: Date): Promise<number> {
  // This would integrate with your availability system
  // For now, return a simulated value
  return Math.floor(Math.random() * 10) + 5;
}

function calculateDemandLevel(bookings: number, utilization: number, searchConversion: number, viewConversion: number): {
  demandLevel: "very_low" | "low" | "normal" | "high" | "very_high" | "extreme",
  demandScore: number
} {
  // Calculate weighted demand score (0-10 scale)
  const bookingScore = Math.min(bookings * 2, 10); // Max 5 bookings = score 10
  const utilizationScore = utilization * 10;
  const conversionScore = (searchConversion + viewConversion) * 5;
  
  const demandScore = (bookingScore * 0.4 + utilizationScore * 0.4 + conversionScore * 0.2);
  
  let demandLevel: "very_low" | "low" | "normal" | "high" | "very_high" | "extreme";
  
  if (demandScore <= 2) demandLevel = "very_low";
  else if (demandScore <= 4) demandLevel = "low";
  else if (demandScore <= 6) demandLevel = "normal";
  else if (demandScore <= 8) demandLevel = "high";
  else if (demandScore <= 9) demandLevel = "very_high";
  else demandLevel = "extreme";
  
  return { demandLevel, demandScore };
}

function calculateMarketShare(bookings: number, competitorAvgPrice: number): string {
  // Simplified market share estimation
  if (!competitorAvgPrice || bookings === 0) return "0.0000";
  
  // This would be more sophisticated in practice
  const estimatedShare = Math.min(bookings * 0.1, 1.0);
  return estimatedShare.toString();
}

function generateMockCompetitorData(category: string, location: string) {
  // Generate realistic mock competitor pricing data
  const basePrices = {
    cleaning: 5000, // $50/hour
    handyman: 7500, // $75/hour
    beauty: 8000, // $80/session
    fitness: 6000, // $60/session
    tutoring: 4000 // $40/hour
  };
  
  const basePrice = basePrices[category as keyof typeof basePrices] || 5000;
  const variance = 0.3; // 30% price variance
  const price = Math.round(basePrice * (1 + (Math.random() - 0.5) * variance));
  
  return {
    location,
    category,
    competitorName: `Competitor ${Math.floor(Math.random() * 100)}`,
    competitorType: "individual" as const,
    serviceName: `${category} service`,
    priceCents: price,
    priceUnit: "hour",
    dataSource: "simulated",
    confidence: "0.85",
    isActive: true,
    observedAt: new Date()
  };
}

async function getCompetitorAveragePrice(providerId: string): Promise<number | null> {
  // This would look up the provider's category and location
  // then return competitor average for that market
  return null; // Simplified for now
}

function getNextRunTime(): string {
  const next = new Date();
  next.setHours(next.getHours() + 2); // Runs every 2 hours
  return next.toISOString();
}

// Notification functions
async function notifyProviderOfSurge(providerId: string, serviceName: string, multiplier: number) {
  console.log(`Notifying provider ${providerId}: Surge pricing active for ${serviceName} (${multiplier}x)`);
}

async function sendPriceAlertNotification(customerId: string, reason: string, serviceName: string, newPrice: number) {
  console.log(`Price alert for customer ${customerId}: ${reason} - ${serviceName} now $${(newPrice / 100).toFixed(2)}`);
}

async function notifyProviderOfInsights(providerId: string, insights: any[]) {
  console.log(`Sending ${insights.length} pricing insights to provider ${providerId}`);
}

async function logPricingMetrics(result: any) {
  console.log("[METRICS] Pricing analytics metrics:", result);
  
  if (process.env.ANALYTICS_ENDPOINT) {
    try {
      await fetch(process.env.ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "pricing_analytics_completed",
          properties: result
        })
      });
    } catch (error) {
      console.error("Failed to log metrics:", error);
    }
  }
}

async function notifyAdminOfCronFailure(job: string, error: any) {
  console.error(`CRON JOB FAILURE - Admin notification needed:`, {
    job,
    error: error.message,
    timestamp: new Date().toISOString(),
  });
  
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 ${job} Cron Job Failed`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Job:* ${job}\n*Error:* ${error.message}\n*Time:* ${new Date().toISOString()}`,
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.error("Failed to send Slack alert:", e);
    }
  }
}

// Health check endpoint for monitoring
export async function HEAD(req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}