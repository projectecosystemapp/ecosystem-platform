#!/usr/bin/env node

/**
 * Query Performance Benchmarking Script
 * Run this before and after applying optimizations to measure impact
 */

import { db } from "../db/db";
import { providersTable, bookingsTable, providerAvailabilityTable, profilesTable } from "../db/schema";
import { eq, and, or, gte, lte, like, ilike, sql, desc, between } from "drizzle-orm";
import { performance } from "perf_hooks";

interface BenchmarkResult {
  testName: string;
  executionTime: number;
  rowsReturned?: number;
  error?: string;
}

class QueryBenchmark {
  private results: BenchmarkResult[] = [];

  async runBenchmark(testName: string, queryFn: () => Promise<any>): Promise<void> {
    console.log(`Running ${testName}...`);
    
    try {
      const startTime = performance.now();
      const result = await queryFn();
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      const rowsReturned = Array.isArray(result) ? result.length : result ? 1 : 0;
      
      this.results.push({
        testName,
        executionTime,
        rowsReturned
      });
      
      console.log(`✅ ${testName}: ${executionTime.toFixed(2)}ms (${rowsReturned} rows)`);
    } catch (error) {
      console.log(`❌ ${testName}: Failed`);
      this.results.push({
        testName,
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async runAllBenchmarks(): Promise<void> {
    console.log("🚀 Starting Database Query Benchmarks\n");

    // 1. Provider Search Queries
    await this.runBenchmark("Provider Search - Text Query (ILIKE)", async () => {
      return await db
        .select()
        .from(providersTable)
        .where(
          and(
            eq(providersTable.isActive, true),
            or(
              ilike(providersTable.displayName, "%yoga%"),
              ilike(providersTable.tagline, "%yoga%"),
              ilike(providersTable.bio, "%yoga%")
            )
          )
        )
        .limit(20);
    });

    await this.runBenchmark("Provider Search - Location Filter", async () => {
      return await db
        .select()
        .from(providersTable)
        .where(
          and(
            eq(providersTable.isActive, true),
            eq(providersTable.locationCity, "San Francisco"),
            eq(providersTable.locationState, "CA")
          )
        )
        .limit(20);
    });

    await this.runBenchmark("Provider Search - Price Range", async () => {
      return await db
        .select()
        .from(providersTable)
        .where(
          and(
            eq(providersTable.isActive, true),
            gte(sql`${providersTable.hourlyRate}::numeric`, 50),
            lte(sql`${providersTable.hourlyRate}::numeric`, 150)
          )
        )
        .limit(20);
    });

    await this.runBenchmark("Featured Providers Query", async () => {
      return await db
        .select()
        .from(providersTable)
        .where(
          and(
            eq(providersTable.isActive, true),
            eq(providersTable.isVerified, true),
            gte(sql`${providersTable.averageRating}::numeric`, 4.5)
          )
        )
        .orderBy(desc(providersTable.completedBookings))
        .limit(6);
    });

    // 2. Booking Queries
    await this.runBenchmark("Booking Conflict Detection", async () => {
      // Simulate checking for conflicts on a specific date/time
      const testDate = new Date('2024-01-15');
      const testProviderId = "test-provider-id";
      
      return await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, testProviderId),
            eq(bookingsTable.bookingDate, testDate),
            or(
              and(
                lte(bookingsTable.startTime, "14:00"),
                gte(bookingsTable.endTime, "14:00")
              ),
              and(
                lte(bookingsTable.startTime, "15:00"),
                gte(bookingsTable.endTime, "15:00")
              )
            )
          )
        );
    });

    await this.runBenchmark("Customer Bookings History", async () => {
      const testCustomerId = "test-customer-id";
      
      return await db
        .select({
          booking: bookingsTable,
          provider: providersTable,
        })
        .from(bookingsTable)
        .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
        .where(eq(bookingsTable.customerId, testCustomerId))
        .orderBy(desc(bookingsTable.bookingDate), desc(bookingsTable.startTime))
        .limit(50);
    });

    await this.runBenchmark("Provider Upcoming Bookings", async () => {
      const testProviderId = "test-provider-id";
      const now = new Date();
      
      return await db
        .select({
          booking: bookingsTable,
          customerEmail: profilesTable.email,
        })
        .from(bookingsTable)
        .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
        .where(
          and(
            eq(bookingsTable.providerId, testProviderId),
            eq(bookingsTable.status, "confirmed"),
            gte(bookingsTable.bookingDate, now)
          )
        )
        .orderBy(bookingsTable.bookingDate, bookingsTable.startTime)
        .limit(10);
    });

    // 3. Availability Queries
    await this.runBenchmark("Provider Availability Lookup", async () => {
      const testProviderId = "test-provider-id";
      
      return await db
        .select()
        .from(providerAvailabilityTable)
        .where(
          and(
            eq(providerAvailabilityTable.providerId, testProviderId),
            eq(providerAvailabilityTable.isActive, true)
          )
        )
        .orderBy(providerAvailabilityTable.dayOfWeek);
    });

    // 4. Dashboard Statistics Queries
    await this.runBenchmark("Provider Statistics Query", async () => {
      const testProviderId = "test-provider-id";
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return await db
        .select({
          totalBookings: sql<number>`count(*)`,
          completedBookings: sql<number>`count(*) filter (where status = 'completed')`,
          upcomingBookings: sql<number>`count(*) filter (where status = 'confirmed' and booking_date >= current_date)`,
          totalRevenue: sql<number>`sum(provider_payout::numeric) filter (where status = 'completed')`,
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, testProviderId),
            gte(bookingsTable.bookingDate, thirtyDaysAgo)
          )
        );
    });

    // 5. Complex Searches with Joins
    await this.runBenchmark("Complex Provider Search with Stats", async () => {
      return await db
        .select({
          provider: providersTable,
          recentBookings: sql<number>`count(b.id) filter (where b.booking_date >= current_date - interval '30 days')`,
          avgRating: providersTable.averageRating,
        })
        .from(providersTable)
        .leftJoin(bookingsTable, eq(providersTable.id, bookingsTable.providerId))
        .where(
          and(
            eq(providersTable.isActive, true),
            eq(providersTable.locationState, "CA"),
            gte(sql`${providersTable.averageRating}::numeric`, 4.0)
          )
        )
        .groupBy(providersTable.id)
        .orderBy(desc(sql`count(b.id) filter (where b.booking_date >= current_date - interval '30 days')`))
        .limit(20);
    });

    console.log("\n📊 Benchmark Results Summary:");
    console.log("=" .repeat(50));
    
    this.results.forEach(result => {
      if (result.error) {
        console.log(`❌ ${result.testName}: ERROR - ${result.error}`);
      } else {
        console.log(`${result.executionTime > 100 ? '🐌' : '⚡'} ${result.testName}: ${result.executionTime.toFixed(2)}ms`);
      }
    });
    
    const totalTime = this.results.reduce((sum, r) => sum + r.executionTime, 0);
    const slowQueries = this.results.filter(r => r.executionTime > 100);
    
    console.log("\n📈 Performance Analysis:");
    console.log(`Total execution time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average query time: ${(totalTime / this.results.length).toFixed(2)}ms`);
    console.log(`Slow queries (>100ms): ${slowQueries.length}`);
    
    if (slowQueries.length > 0) {
      console.log("\n🚨 Queries needing optimization:");
      slowQueries.forEach(q => {
        console.log(`  • ${q.testName}: ${q.executionTime.toFixed(2)}ms`);
      });
    }
  }

  // Export results for comparison
  exportResults(): any {
    return {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalQueries: this.results.length,
        totalTime: this.results.reduce((sum, r) => sum + r.executionTime, 0),
        averageTime: this.results.reduce((sum, r) => sum + r.executionTime, 0) / this.results.length,
        slowQueries: this.results.filter(r => r.executionTime > 100).length,
      }
    };
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const benchmark = new QueryBenchmark();
  benchmark.runAllBenchmarks()
    .then(() => {
      console.log("\n✅ Benchmarking complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Benchmark failed:", error);
      process.exit(1);
    });
}

export { QueryBenchmark };
