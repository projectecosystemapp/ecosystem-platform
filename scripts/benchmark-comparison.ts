#!/usr/bin/env node

/**
 * Comprehensive Benchmark Comparison Tool
 * Captures baseline performance metrics and compares optimized vs original queries
 */

import { db } from "../db/db";
import { 
  providersTable, 
  bookingsTable, 
  profilesTable,
  providerAvailabilityTable,
  providerTestimonialsTable
} from "../db/schema";
import { 
  searchProviders, 
  getFeaturedProviders,
  getProviderBySlug
} from "../db/queries/providers-queries";
import {
  calculateAvailableSlots as calculateAvailableSlotsOriginal,
  getBookingStatistics as getBookingStatisticsOriginal
} from "../db/queries/bookings-queries";
import {
  searchProvidersOptimized,
  getFeaturedProvidersOptimized, 
  getProviderBySlugOptimized,
  calculateAvailableSlotsOptimized,
  getProviderStatisticsOptimized
} from "../db/queries/optimized-providers-queries";
import { ProviderCache, CacheWarmer, cache } from "../lib/cache";
import { sql, eq, and, gte, lte, desc, ilike, or } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  queryName: string;
  version: 'original' | 'optimized';
  executionTime: number;
  rowCount: number;
  memoryUsed: number;
  cacheStatus?: 'hit' | 'miss' | 'n/a';
  timestamp: Date;
  error?: string;
}

interface ComparisonReport {
  baseline: BenchmarkResult[];
  optimized: BenchmarkResult[];
  improvements: {
    [queryName: string]: {
      timeImprovement: string;
      percentageImprovement: number;
      verdict: 'improved' | 'degraded' | 'unchanged';
      baselineTime: number;
      optimizedTime: number;
    };
  };
  summary: {
    totalQueries: number;
    improved: number;
    degraded: number;
    unchanged: number;
    averageImprovement: number;
    totalTimeSaved: number;
  };
  metadata: {
    testDate: Date;
    cacheEnabled: boolean;
    dbConnectionPool: number;
  };
}

class BenchmarkComparison {
  private results: BenchmarkResult[] = [];
  private isOptimized: boolean = false;
  private warmupRuns: number = 2;
  private benchmarkRuns: number = 5;

  constructor(optimized: boolean = false) {
    this.isOptimized = optimized;
  }

  async captureBaseline(): Promise<BenchmarkResult[]> {
    console.log(`📊 Capturing ${this.isOptimized ? 'optimized' : 'baseline'} metrics...\n`);
    
    // Clear cache before testing to ensure fair comparison
    if (this.isOptimized) {
      try {
        await this.clearCache();
        console.log('🧹 Cache cleared for clean testing\n');
      } catch (error) {
        console.log('⚠️  Cache clear failed (might not be available):', error);
      }
    }

    // Test 1: Provider Search - Simple text search
    await this.benchmarkQuery('Provider Search - Text', async () => {
      if (this.isOptimized) {
        return await searchProvidersOptimized({
          query: 'yoga instructor',
          limit: 20
        });
      } else {
        return await searchProviders({
          query: 'yoga instructor',
          limit: 20
        });
      }
    });

    // Test 2: Provider Search - Location-based
    await this.benchmarkQuery('Provider Search - Location', async () => {
      if (this.isOptimized) {
        return await searchProvidersOptimized({
          city: 'Toronto',
          state: 'ON',
          limit: 20
        });
      } else {
        return await searchProviders({
          city: 'Toronto', 
          state: 'ON',
          limit: 20
        });
      }
    });

    // Test 3: Provider Search - Complex filters
    await this.benchmarkQuery('Provider Search - Complex', async () => {
      if (this.isOptimized) {
        return await searchProvidersOptimized({
          query: 'personal trainer',
          city: 'Toronto',
          minPrice: 50,
          maxPrice: 150,
          minRating: 4.0,
          sortBy: 'rating',
          limit: 20
        });
      } else {
        return await searchProviders({
          query: 'personal trainer',
          city: 'Toronto',
          minPrice: 50,
          maxPrice: 150,
          minRating: 4.0,
          limit: 20
        });
      }
    });

    // Test 4: Featured Providers Query
    await this.benchmarkQuery('Featured Providers', async () => {
      if (this.isOptimized) {
        return await getFeaturedProvidersOptimized(6);
      } else {
        return await getFeaturedProviders(6);
      }
    });

    // Test 5: Provider Profile Lookup
    await this.benchmarkQuery('Provider Profile Lookup', async () => {
      if (this.isOptimized) {
        return await getProviderBySlugOptimized('test-provider-slug');
      } else {
        return await getProviderBySlug('test-provider-slug');
      }
    });

    // Test 6: Availability Calculation
    await this.benchmarkQuery('Availability Calculation', async () => {
      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      if (this.isOptimized) {
        return await calculateAvailableSlotsOptimized(
          'test-provider-id',
          startDate,
          endDate,
          60
        );
      } else {
        return await calculateAvailableSlotsOriginal(
          'test-provider-id',
          startDate,
          endDate,
          60
        );
      }
    });

    // Test 7: Dashboard Statistics
    await this.benchmarkQuery('Dashboard Statistics', async () => {
      if (this.isOptimized) {
        return await getProviderStatisticsOptimized('test-provider-id');
      } else {
        return await getBookingStatisticsOriginal('test-provider-id', 'provider');
      }
    });

    // Test 8: Database aggregate queries
    await this.benchmarkQuery('Database Aggregates', async () => {
      const [totalProviders, totalBookings, recentActivity] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(providersTable),
        db.select({ count: sql<number>`COUNT(*)` }).from(bookingsTable),
        db.select({ 
          count: sql<number>`COUNT(DISTINCT ${bookingsTable.customerId})` 
        })
        .from(bookingsTable)
        .where(gte(bookingsTable.createdAt, sql`NOW() - INTERVAL '30 days'`))
      ]);
      
      return { totalProviders, totalBookings, recentActivity };
    });

    // Test 9: Complex JOIN query
    await this.benchmarkQuery('Complex JOIN Query', async () => {
      return await db
        .select({
          provider: providersTable,
          recentBookings: sql<number>`COUNT(DISTINCT ${bookingsTable.id})`,
          avgRating: sql<number>`AVG(${providersTable.averageRating}::numeric)`,
        })
        .from(providersTable)
        .leftJoin(bookingsTable, eq(providersTable.id, bookingsTable.providerId))
        .where(
          and(
            eq(providersTable.isActive, true),
            gte(bookingsTable.bookingDate, sql`CURRENT_DATE - INTERVAL '90 days'`)
          )
        )
        .groupBy(providersTable.id)
        .orderBy(desc(sql`COUNT(DISTINCT ${bookingsTable.id})`))
        .limit(10);
    });

    // Test 10: Booking conflict detection
    await this.benchmarkQuery('Booking Conflict Detection', async () => {
      const testDate = new Date();
      const testStartTime = '14:00';
      const testEndTime = '15:00';
      
      return await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, 'test-provider-id'),
            eq(bookingsTable.bookingDate, testDate),
            sql`${bookingsTable.status} NOT IN ('cancelled', 'no_show')`,
            or(
              and(
                sql`${testStartTime} >= ${bookingsTable.startTime}`,
                sql`${testStartTime} < ${bookingsTable.endTime}`
              ),
              and(
                sql`${testEndTime} > ${bookingsTable.startTime}`,
                sql`${testEndTime} <= ${bookingsTable.endTime}`
              )
            )
          )
        );
    });

    console.log(`\n✅ Completed ${this.results.length} benchmark tests\n`);
    return this.results;
  }

  private async benchmarkQuery(
    name: string,
    queryFn: () => Promise<any>
  ): Promise<void> {
    console.log(`🔍 Testing ${name}...`);
    
    try {
      // Warmup runs
      for (let i = 0; i < this.warmupRuns; i++) {
        await queryFn();
      }

      // Actual benchmark runs
      const runs: number[] = [];
      const memoryBefore = process.memoryUsage().heapUsed;
      let result: any;

      for (let i = 0; i < this.benchmarkRuns; i++) {
        const startTime = performance.now();
        result = await queryFn();
        const endTime = performance.now();
        runs.push(endTime - startTime);
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const avgTime = runs.reduce((a, b) => a + b, 0) / runs.length;
      const rowCount = this.getRowCount(result);

      this.results.push({
        queryName: name,
        version: this.isOptimized ? 'optimized' : 'original',
        executionTime: avgTime,
        rowCount,
        memoryUsed: (memoryAfter - memoryBefore) / 1024 / 1024, // MB
        cacheStatus: this.isOptimized ? 'n/a' : 'n/a', // Will be enhanced later
        timestamp: new Date()
      });

      console.log(`   ✓ ${avgTime.toFixed(2)}ms (${rowCount} rows)`);

    } catch (error) {
      console.log(`   ✗ Error: ${error}`);
      this.results.push({
        queryName: name,
        version: this.isOptimized ? 'optimized' : 'original',
        executionTime: -1,
        rowCount: 0,
        memoryUsed: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private getRowCount(result: any): number {
    if (Array.isArray(result)) {
      return result.length;
    }
    if (result && typeof result === 'object') {
      if ('providers' in result && Array.isArray(result.providers)) {
        return result.providers.length;
      }
      if ('data' in result && Array.isArray(result.data)) {
        return result.data.length;
      }
      return 1;
    }
    return result ? 1 : 0;
  }

  private async clearCache(): Promise<void> {
    // Clear all provider-related caches using the public cache API
    try {
      await cache.deletePattern('provider:*');
      await cache.deletePattern('featured:*');
      await cache.deletePattern('booking:*');
      await cache.deletePattern('dashboard:*');
    } catch (error) {
      console.log('Cache clear skipped (Redis not available)');
    }
  }

  saveResults(filename: string): void {
    const benchmarkDir = path.join(process.cwd(), 'benchmarks');
    if (!fs.existsSync(benchmarkDir)) {
      fs.mkdirSync(benchmarkDir, { recursive: true });
    }
    
    const filepath = path.join(benchmarkDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`💾 Results saved to ${filepath}`);
  }

  async compareResults(
    baselineFile: string,
    optimizedFile: string
  ): Promise<ComparisonReport> {
    const benchmarkDir = path.join(process.cwd(), 'benchmarks');
    const baselinePath = path.join(benchmarkDir, baselineFile);
    const optimizedPath = path.join(benchmarkDir, optimizedFile);

    if (!fs.existsSync(baselinePath) || !fs.existsSync(optimizedPath)) {
      throw new Error('Benchmark files not found. Run baseline and optimized tests first.');
    }

    const baseline: BenchmarkResult[] = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    const optimized: BenchmarkResult[] = JSON.parse(fs.readFileSync(optimizedPath, 'utf-8'));

    const improvements: ComparisonReport['improvements'] = {};
    let totalImprovement = 0;
    let totalTimeSaved = 0;
    let improvedCount = 0;
    let degradedCount = 0;
    let unchangedCount = 0;

    baseline.forEach((baseResult) => {
      const optResult = optimized.find(o => o.queryName === baseResult.queryName);
      
      if (optResult && baseResult.executionTime > 0 && optResult.executionTime > 0) {
        const improvement = baseResult.executionTime - optResult.executionTime;
        const percentage = (improvement / baseResult.executionTime) * 100;
        
        let verdict: 'improved' | 'degraded' | 'unchanged';
        if (percentage > 5) {
          verdict = 'improved';
          improvedCount++;
        } else if (percentage < -5) {
          verdict = 'degraded';
          degradedCount++;
        } else {
          verdict = 'unchanged';
          unchangedCount++;
        }

        improvements[baseResult.queryName] = {
          timeImprovement: `${improvement.toFixed(2)}ms`,
          percentageImprovement: percentage,
          verdict,
          baselineTime: baseResult.executionTime,
          optimizedTime: optResult.executionTime
        };

        totalImprovement += percentage;
        totalTimeSaved += improvement;
      }
    });

    return {
      baseline,
      optimized,
      improvements,
      summary: {
        totalQueries: baseline.length,
        improved: improvedCount,
        degraded: degradedCount,
        unchanged: unchangedCount,
        averageImprovement: totalImprovement / baseline.length,
        totalTimeSaved
      },
      metadata: {
        testDate: new Date(),
        cacheEnabled: true,
        dbConnectionPool: 20 // This would be read from config
      }
    };
  }

  generateReport(comparison: ComparisonReport): void {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 DATABASE OPTIMIZATION PERFORMANCE REPORT');
    console.log('='.repeat(70) + '\n');
    
    // Summary section
    console.log('📊 EXECUTIVE SUMMARY');
    console.log('-'.repeat(40));
    console.log(`📈 Average Performance Improvement: ${comparison.summary.averageImprovement.toFixed(1)}%`);
    console.log(`⏱️  Total Time Saved Per Test Cycle: ${comparison.summary.totalTimeSaved.toFixed(2)}ms`);
    console.log(`✅ Queries Improved: ${comparison.summary.improved}/${comparison.summary.totalQueries}`);
    console.log(`❌ Queries Degraded: ${comparison.summary.degraded}/${comparison.summary.totalQueries}`);
    console.log(`➖ Queries Unchanged: ${comparison.summary.unchanged}/${comparison.summary.totalQueries}\n`);
    
    // Detailed results
    console.log('🔍 DETAILED RESULTS');
    console.log('-'.repeat(40));
    
    // Sort by improvement percentage for better readability
    const sortedResults = Object.entries(comparison.improvements)
      .sort(([,a], [,b]) => b.percentageImprovement - a.percentageImprovement);
    
    sortedResults.forEach(([query, data]) => {
      const emoji = data.verdict === 'improved' ? '✅' : 
                    data.verdict === 'degraded' ? '❌' : '➖';
      
      console.log(`${emoji} ${query}`);
      console.log(`   Baseline: ${data.baselineTime.toFixed(2)}ms → Optimized: ${data.optimizedTime.toFixed(2)}ms`);
      console.log(`   Improvement: ${data.timeImprovement} (${data.percentageImprovement.toFixed(1)}%)`);
      console.log(`   Status: ${data.verdict.toUpperCase()}\n`);
    });

    // Generate detailed reports
    this.generateHTMLReport(comparison);
    this.generateCSVReport(comparison);
    
    console.log('📄 Reports generated:');
    console.log('   - benchmarks/report.html (Interactive charts)');
    console.log('   - benchmarks/report.csv (Data export)');
    console.log('   - benchmarks/summary.json (Raw data)\n');
  }

  private generateHTMLReport(comparison: ComparisonReport): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Optimization Performance Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 2rem; 
            background: #f8fafc;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 3rem; }
        .summary { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 2rem; 
            border-radius: 12px; 
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .summary h2 { margin-top: 0; }
        .metric { display: inline-block; margin-right: 2rem; }
        .metric-value { font-size: 2rem; font-weight: bold; display: block; }
        .chart-container { 
            background: white; 
            padding: 2rem; 
            border-radius: 12px; 
            margin: 2rem 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chart-container h3 { margin-top: 0; color: #1a202c; }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f7fafc; font-weight: 600; color: #2d3748; }
        .improved { color: #38a169; font-weight: 600; }
        .degraded { color: #e53e3e; font-weight: 600; }
        .unchanged { color: #718096; }
        .timestamp { text-align: center; color: #718096; margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Database Query Optimization Report</h1>
            <p>Performance comparison between baseline and optimized queries</p>
        </div>
        
        <div class="summary">
            <h2>Performance Summary</h2>
            <div class="metric">
                <span class="metric-value">${comparison.summary.averageImprovement.toFixed(1)}%</span>
                <span>Average Improvement</span>
            </div>
            <div class="metric">
                <span class="metric-value">${comparison.summary.improved}/${comparison.summary.totalQueries}</span>
                <span>Queries Improved</span>
            </div>
            <div class="metric">
                <span class="metric-value">${comparison.summary.totalTimeSaved.toFixed(1)}ms</span>
                <span>Total Time Saved</span>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>Query Performance Comparison</h3>
            <canvas id="performanceChart" height="400"></canvas>
        </div>
        
        <div class="chart-container">
            <h3>Performance Improvement Distribution</h3>
            <canvas id="improvementChart" height="300"></canvas>
        </div>
        
        <div class="chart-container">
            <h3>Detailed Results</h3>
            <table>
                <thead>
                    <tr>
                        <th>Query Name</th>
                        <th>Baseline (ms)</th>
                        <th>Optimized (ms)</th>
                        <th>Improvement</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(comparison.improvements).map(([query, data]) => `
                        <tr>
                            <td>${query}</td>
                            <td>${data.baselineTime.toFixed(2)}</td>
                            <td>${data.optimizedTime.toFixed(2)}</td>
                            <td class="${data.verdict}">${data.percentageImprovement.toFixed(1)}%</td>
                            <td class="${data.verdict}">${data.verdict.toUpperCase()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="timestamp">
            Report generated on ${comparison.metadata.testDate.toLocaleString()}
        </div>
    </div>
    
    <script>
        // Performance comparison chart
        const ctx1 = document.getElementById('performanceChart').getContext('2d');
        new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(Object.keys(comparison.improvements))},
                datasets: [{
                    label: 'Baseline (ms)',
                    data: ${JSON.stringify(Object.values(comparison.improvements).map(d => d.baselineTime))},
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }, {
                    label: 'Optimized (ms)',
                    data: ${JSON.stringify(Object.values(comparison.improvements).map(d => d.optimizedTime))},
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Query Execution Times Comparison' }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Execution Time (ms)' } }
                }
            }
        });
        
        // Improvement distribution chart
        const ctx2 = document.getElementById('improvementChart').getContext('2d');
        const improvements = ${JSON.stringify(Object.values(comparison.improvements).map(d => d.percentageImprovement))};
        new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Improved', 'Degraded', 'Unchanged'],
                datasets: [{
                    data: [${comparison.summary.improved}, ${comparison.summary.degraded}, ${comparison.summary.unchanged}],
                    backgroundColor: ['#22c55e', '#ef4444', '#94a3b8']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Query Improvement Status Distribution' }
                }
            }
        });
    </script>
</body>
</html>`;
    
    const benchmarkDir = path.join(process.cwd(), 'benchmarks');
    fs.writeFileSync(path.join(benchmarkDir, 'report.html'), html);
  }

  private generateCSVReport(comparison: ComparisonReport): void {
    const csv = [
      'Query,Baseline (ms),Optimized (ms),Improvement (ms),Improvement (%),Status',
      ...Object.entries(comparison.improvements).map(([query, data]) => 
        `"${query}",${data.baselineTime.toFixed(2)},${data.optimizedTime.toFixed(2)},${data.timeImprovement},${data.percentageImprovement.toFixed(2)},${data.verdict}`
      )
    ].join('\n');
    
    const benchmarkDir = path.join(process.cwd(), 'benchmarks');
    fs.writeFileSync(path.join(benchmarkDir, 'report.csv'), csv);
    
    // Also save raw comparison data as JSON
    fs.writeFileSync(
      path.join(benchmarkDir, 'summary.json'), 
      JSON.stringify(comparison, null, 2)
    );
  }
}

// Main execution
async function main() {
  const mode = process.argv[2]; // 'baseline' | 'optimized' | 'compare'
  
  try {
    if (mode === 'baseline') {
      console.log('🎯 Running baseline benchmarks...\n');
      const benchmark = new BenchmarkComparison(false);
      await benchmark.captureBaseline();
      benchmark.saveResults('baseline.json');
      
    } else if (mode === 'optimized') {
      console.log('🚀 Running optimized benchmarks...\n');
      const benchmark = new BenchmarkComparison(true);
      await benchmark.captureBaseline();
      benchmark.saveResults('optimized.json');
      
    } else if (mode === 'compare') {
      console.log('📊 Comparing baseline vs optimized results...\n');
      const benchmark = new BenchmarkComparison();
      const comparison = await benchmark.compareResults('baseline.json', 'optimized.json');
      benchmark.generateReport(comparison);
      
    } else {
      console.log('📋 Usage:');
      console.log('  npm run benchmark:baseline  - Capture baseline performance');
      console.log('  npm run benchmark:optimized - Test optimized queries');
      console.log('  npm run benchmark:compare   - Generate comparison report');
      console.log('  npm run benchmark:full      - Run complete test suite');
    }
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(console.error);
}

export { BenchmarkComparison };
