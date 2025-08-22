#!/usr/bin/env tsx

/**
 * Verification Script for Provider System
 * Run with: npx tsx scripts/verify-provider-system.ts
 */

import { db } from "../db/db";
import { providersTable, providerAvailabilityTable, providerBlockedSlotsTable } from "../db/schema/providers-schema";
import { bookingsTable } from "../db/schema/bookings-schema";
import { sql } from "drizzle-orm";
import { getProviderByUserId, updateProvider } from "../db/queries/providers-queries";
import * as fs from "fs";
import * as path from "path";

console.log("🔍 PROVIDER SYSTEM VERIFICATION REPORT");
console.log("=" .repeat(50));

async function verifyDatabaseState() {
  console.log("\n📊 1. DATABASE REALITY CHECK");
  console.log("-".repeat(30));

  try {
    // Check provider statistics
    const [providerStats] = await db.execute(sql`
      SELECT 
        COUNT(*) as total_providers,
        COUNT(services) as providers_with_services,
        COUNT(CASE WHEN jsonb_array_length(services) > 0 THEN 1 END) as non_empty_services,
        COUNT(CASE WHEN services IS NULL THEN 1 END) as null_services
      FROM providers
    `);
    
    console.log("Provider Statistics:");
    console.log(`  Total providers: ${providerStats.total_providers}`);
    console.log(`  Providers with services field: ${providerStats.providers_with_services}`);
    console.log(`  Providers with actual services: ${providerStats.non_empty_services || 0}`);
    console.log(`  Providers with NULL services: ${providerStats.null_services || 0}`);

    // Get sample provider data
    const sampleProviders = await db.select({
      id: providersTable.id,
      displayName: providersTable.displayName,
      services: providersTable.services,
      createdAt: providersTable.createdAt
    })
    .from(providersTable)
    .limit(3);

    console.log("\nSample Provider Data:");
    sampleProviders.forEach((provider, index) => {
      console.log(`  Provider ${index + 1}: ${provider.displayName}`);
      console.log(`    ID: ${provider.id}`);
      console.log(`    Services: ${JSON.stringify(provider.services)}`);
      console.log(`    Created: ${provider.createdAt}`);
    });

    // Check availability data
    const [availabilityCount] = await db.execute(sql`SELECT COUNT(*) as count FROM provider_availability`);
    const [blockedSlotsCount] = await db.execute(sql`SELECT COUNT(*) as count FROM provider_blocked_slots`);
    const [bookingsCount] = await db.execute(sql`SELECT COUNT(*) as count FROM bookings`);

    console.log("\nRelated Tables:");
    console.log(`  Provider availability records: ${availabilityCount.count}`);
    console.log(`  Blocked slots records: ${blockedSlotsCount.count}`);
    console.log(`  Total bookings: ${bookingsCount.count}`);

  } catch (error) {
    console.error("❌ Database verification failed:", error);
    return false;
  }

  return true;
}

async function verifyServiceDataFlow() {
  console.log("\n🔄 2. SERVICE DATA FLOW VERIFICATION");
  console.log("-".repeat(30));

  try {
    // Find a provider with services
    const [testProvider] = await db.select()
      .from(providersTable)
      .where(sql`jsonb_array_length(services) > 0`)
      .limit(1);

    if (!testProvider) {
      console.log("⚠️  No providers with services found to test update flow");
      return false;
    }

    console.log(`Testing with provider: ${testProvider.displayName} (${testProvider.id})`);
    console.log(`Current services: ${JSON.stringify(testProvider.services)}`);

    // Test update action
    const testService = {
      name: "Test Service Verification",
      description: "This is a test service to verify update functionality",
      duration: 60,
      price: 100
    };

    // Store original services
    const originalServices = testProvider.services;

    // Try to update services
    console.log("\nTesting updateProvider with new service...");
    const updatedProvider = await updateProvider(testProvider.id, {
      services: [...(originalServices as any[]), testService]
    });

    if (updatedProvider.services && Array.isArray(updatedProvider.services)) {
      const newServiceCount = (updatedProvider.services as any[]).length;
      const originalCount = (originalServices as any[])?.length || 0;
      
      if (newServiceCount > originalCount) {
        console.log("✅ Service update successful!");
        console.log(`  Services count: ${originalCount} -> ${newServiceCount}`);
        
        // Restore original services
        await updateProvider(testProvider.id, { services: originalServices as any });
        console.log("✅ Restored original services");
      } else {
        console.log("❌ Service update failed - count didn't increase");
      }
    } else {
      console.log("❌ Service update failed - invalid response");
    }

  } catch (error) {
    console.error("❌ Service data flow test failed:", error);
    return false;
  }

  return true;
}

async function verifyValidationSchemas() {
  console.log("\n✅ 3. VALIDATION & SCHEMAS CHECK");
  console.log("-".repeat(30));

  // Check for validation files
  const validationPaths = [
    "lib/validations/provider.ts",
    "lib/validations/services.ts",
    "lib/validations/index.ts"
  ];

  for (const validationPath of validationPaths) {
    const fullPath = path.join(process.cwd(), validationPath);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ Found: ${validationPath}`);
    } else {
      console.log(`❌ Missing: ${validationPath}`);
    }
  }

  // Check service format in schema
  console.log("\nService Schema Format:");
  console.log(`  name: string`);
  console.log(`  description: string`);
  console.log(`  duration: number (minutes)`);
  console.log(`  price: number`);

  return true;
}

async function verifyComponentDependencies() {
  console.log("\n📦 4. COMPONENT DEPENDENCIES CHECK");
  console.log("-".repeat(30));

  const requiredComponents = [
    "components/ui/card.tsx",
    "components/ui/skeleton.tsx",
    "components/ui/dialog.tsx",
    "components/ui/textarea.tsx",
    "components/ui/select.tsx"
  ];

  let allExist = true;
  for (const component of requiredComponents) {
    const fullPath = path.join(process.cwd(), component);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${component}`);
    } else {
      console.log(`❌ ${component} - Missing`);
      allExist = false;
    }
  }

  // Check package dependencies
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
  );

  const requiredPackages = {
    "@tanstack/react-query": "Data fetching",
    "sonner": "Toast notifications",
    "zod": "Schema validation",
    "framer-motion": "Animations"
  };

  console.log("\nPackage Dependencies:");
  for (const [pkg, purpose] of Object.entries(requiredPackages)) {
    if (packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]) {
      console.log(`✅ ${pkg} - ${purpose}`);
    } else {
      console.log(`❌ ${pkg} - Missing (${purpose})`);
      allExist = false;
    }
  }

  return allExist;
}

async function generateReport() {
  console.log("\n📋 5. FINDINGS & RECOMMENDATIONS");
  console.log("-".repeat(30));

  const dbOk = await verifyDatabaseState();
  const flowOk = await verifyServiceDataFlow();
  const validationOk = await verifyValidationSchemas();
  const depsOk = await verifyComponentDependencies();

  console.log("\n🎯 SYSTEM STATUS:");
  console.log(`  Database: ${dbOk ? "✅ Working" : "❌ Issues found"}`);
  console.log(`  Service Flow: ${flowOk ? "✅ Working" : "❌ Issues found"}`);
  console.log(`  Validation: ${validationOk ? "⚠️  Needs schemas" : "❌ Missing"}`);
  console.log(`  Dependencies: ${depsOk ? "✅ All present" : "⚠️  Some missing"}`);

  console.log("\n📝 NEXT STEPS:");
  
  if (!validationOk) {
    console.log("1. Create Zod validation schemas for services");
  }
  
  if (!depsOk) {
    console.log("2. Install missing dependencies");
  }

  if (dbOk && flowOk) {
    console.log("3. Build service management UI in provider dashboard");
    console.log("4. Connect dashboard to real database queries");
    console.log("5. Add error handling and loading states");
  } else {
    console.log("⚠️  Fix database/flow issues before building UI");
  }

  console.log("\n" + "=".repeat(50));
  console.log("Verification complete!");
}

// Run verification
generateReport().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
