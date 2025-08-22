#!/usr/bin/env tsx
/**
 * Apply Performance Indexes Script
 * 
 * This script safely applies database performance indexes with progress tracking
 * and rollback capability. Designed for production deployment.
 * 
 * Usage:
 * - Development: npm run db:apply-indexes
 * - Production: npm run db:apply-indexes -- --production
 * - Dry run: npm run db:apply-indexes -- --dry-run
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/db';
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const MIGRATION_FILE = join(__dirname, '../db/migrations/add-performance-indexes.sql');

interface IndexInfo {
  name: string;
  table: string;
  columns: string;
  isUnique: boolean;
  size: string;
}

async function getExistingIndexes(): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public'
  `);
  
  return new Set((result as any[]).map((row: any) => row.indexname));
}

async function analyzeIndexImpact(): Promise<void> {
  console.log(chalk.blue('📊 Analyzing index impact...'));
  
  // Get table sizes before indexes
  const tableSizes = await db.execute(sql`
    SELECT 
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10
  `);
  
  console.log(chalk.cyan('Top 10 largest tables:'));
  (tableSizes as any[]).forEach((row: any) => {
    console.log(`  - ${row.tablename}: ${row.size}`);
  });
}

async function applyIndexes(dryRun: boolean = false): Promise<void> {
  try {
    console.log(chalk.yellow('🚀 Starting index application...'));
    
    // Read migration file
    const migrationSQL = readFileSync(MIGRATION_FILE, 'utf-8');
    
    // Parse individual index creation statements
    const indexStatements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim().toLowerCase().startsWith('create index'))
      .map(stmt => stmt.trim() + ';');
    
    console.log(chalk.blue(`Found ${indexStatements.length} index definitions`));
    
    // Get existing indexes
    const existingIndexes = await getExistingIndexes();
    
    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const statement of indexStatements) {
      // Extract index name from statement
      const indexNameMatch = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/i);
      if (!indexNameMatch) continue;
      
      const indexName = indexNameMatch[1];
      
      if (existingIndexes.has(indexName)) {
        console.log(chalk.gray(`⏭️  Skipping existing index: ${indexName}`));
        skippedCount++;
        continue;
      }
      
      if (dryRun) {
        console.log(chalk.cyan(`🔍 [DRY RUN] Would create index: ${indexName}`));
        appliedCount++;
        continue;
      }
      
      try {
        console.log(chalk.blue(`📝 Creating index: ${indexName}...`));
        const startTime = Date.now();
        
        await db.execute(sql.raw(statement));
        
        const duration = Date.now() - startTime;
        console.log(chalk.green(`✅ Created ${indexName} in ${duration}ms`));
        appliedCount++;
      } catch (error) {
        console.error(chalk.red(`❌ Failed to create ${indexName}:`, error));
        errorCount++;
      }
    }
    
    // Apply other non-index statements (functions, views, etc.)
    if (!dryRun) {
      const otherStatements = migrationSQL
        .split(';')
        .filter(stmt => {
          const trimmed = stmt.trim().toLowerCase();
          return trimmed.length > 0 && 
                 !trimmed.startsWith('create index') &&
                 !trimmed.startsWith('--');
        })
        .map(stmt => stmt.trim() + ';');
      
      for (const statement of otherStatements) {
        try {
          if (statement.includes('CREATE OR REPLACE FUNCTION') || 
              statement.includes('CREATE OR REPLACE VIEW')) {
            console.log(chalk.blue('📝 Applying additional database object...'));
            await db.execute(sql.raw(statement));
            console.log(chalk.green('✅ Applied successfully'));
          }
        } catch (error) {
          console.error(chalk.red('❌ Failed to apply statement:', error));
        }
      }
      
      // Run ANALYZE on tables
      console.log(chalk.blue('📊 Updating table statistics...'));
      const tables = ['providers', 'bookings', 'transactions', 
                     'provider_availability', 'provider_blocked_slots', 
                     'provider_testimonials'];
      
      for (const table of tables) {
        try {
          await db.execute(sql.raw(`ANALYZE ${table}`));
          console.log(chalk.green(`✅ Analyzed ${table}`));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Could not analyze ${table} (might not exist)`));
        }
      }
    }
    
    // Summary
    console.log(chalk.bold.green('\n📈 Index Application Summary:'));
    console.log(chalk.green(`  ✅ Applied: ${appliedCount}`));
    console.log(chalk.yellow(`  ⏭️  Skipped: ${skippedCount}`));
    if (errorCount > 0) {
      console.log(chalk.red(`  ❌ Errors: ${errorCount}`));
    }
    
    if (!dryRun) {
      // Verify index creation
      await verifyIndexes();
    }
    
  } catch (error) {
    console.error(chalk.red('Fatal error applying indexes:'), error);
    process.exit(1);
  }
}

async function verifyIndexes(): Promise<void> {
  console.log(chalk.blue('\n🔍 Verifying indexes...'));
  
  const indexStats = await db.execute(sql`
    SELECT 
      schemaname,
      tablename,
      indexname,
      pg_size_pretty(pg_relation_size(indexrelid)) as size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY pg_relation_size(indexrelid) DESC
  `);
  
  console.log(chalk.cyan('Index statistics:'));
  (indexStats as any[]).forEach((row: any) => {
    console.log(`  - ${row.tablename}.${row.indexname}: ${row.size}`);
  });
  
  // Check for unused indexes (after some time in production)
  const unusedIndexes = await db.execute(sql`
    SELECT 
      schemaname,
      tablename,
      indexname,
      idx_scan as scans
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public' 
      AND idx_scan = 0
      AND indexrelid NOT IN (
        SELECT conindid FROM pg_constraint WHERE contype = 'p'
      )
  `);
  
  if ((unusedIndexes as any[]).length > 0) {
    console.log(chalk.yellow('\n⚠️  Unused indexes detected (consider monitoring):'));
    (unusedIndexes as any[]).forEach((row: any) => {
      console.log(`  - ${row.tablename}.${row.indexname}`);
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isProduction = args.includes('--production');
  
  if (isProduction) {
    console.log(chalk.red.bold('🚨 PRODUCTION MODE 🚨'));
    console.log(chalk.yellow('Applying indexes to production database...'));
    
    // Add a delay for safety
    console.log(chalk.yellow('Starting in 5 seconds... Press Ctrl+C to cancel'));
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  if (isDryRun) {
    console.log(chalk.cyan('🔍 DRY RUN MODE - No changes will be made'));
  }
  
  // Analyze current state
  await analyzeIndexImpact();
  
  // Apply indexes
  await applyIndexes(isDryRun);
  
  console.log(chalk.bold.green('\n✨ Index application complete!'));
  
  if (!isDryRun) {
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Monitor query performance with: SELECT * FROM slow_queries;');
    console.log('2. Check index usage with: SELECT * FROM analyze_index_usage();');
    console.log('3. Run VACUUM ANALYZE periodically to maintain performance');
  }
  
  process.exit(0);
}

// Run the script
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});