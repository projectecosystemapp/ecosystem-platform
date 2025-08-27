#!/usr/bin/env tsx

/**
 * Test script for the dynamic pricing engine
 * Run with: npx tsx scripts/test-pricing.ts
 */

import { calculateDynamicPrice, getPricingBreakdown, calculateFees } from '../lib/pricing';

async function testPricing() {
  console.log('🧪 Testing Dynamic Pricing Engine\n');
  console.log('='.repeat(50) + '\n');
  
  // Test 1: Basic fee calculation
  console.log('Test 1: Fee Calculation');
  console.log('-'.repeat(30));
  
  const baseAmountCents = 10000; // $100
  
  // Customer fees
  const customerFees = calculateFees(baseAmountCents, false);
  console.log('Customer (Authenticated):');
  console.log(`  Base Amount: $${baseAmountCents / 100}`);
  console.log(`  Platform Fee: $${customerFees.platformFeeCents / 100}`);
  console.log(`  Stripe Fee: $${customerFees.stripeFeeCents / 100}`);
  console.log(`  Total: $${customerFees.totalCents / 100}`);
  console.log(`  Provider Payout: $${customerFees.providerPayoutCents / 100}`);
  
  // Guest fees
  const guestFees = calculateFees(baseAmountCents, true);
  console.log('\nGuest (Non-Authenticated):');
  console.log(`  Base Amount: $${baseAmountCents / 100}`);
  console.log(`  Platform Fee: $${guestFees.platformFeeCents / 100}`);
  console.log(`  Guest Surcharge: $${guestFees.guestSurchargeCents! / 100}`);
  console.log(`  Stripe Fee: $${guestFees.stripeFeeCents / 100}`);
  console.log(`  Total: $${guestFees.totalCents / 100}`);
  console.log(`  Provider Payout: $${guestFees.providerPayoutCents / 100}`);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Price validation scenarios
  console.log('Test 2: Price Validation');
  console.log('-'.repeat(30));
  
  const testPrices = [
    { base: 50, description: 'Low price service' },
    { base: 100, description: 'Standard service' },
    { base: 500, description: 'Premium service' },
    { base: 1000, description: 'High-end service' },
  ];
  
  for (const { base, description } of testPrices) {
    const baseCents = base * 100;
    const fees = calculateFees(baseCents, false);
    const providerPercent = (fees.providerPayoutCents / baseCents * 100).toFixed(1);
    console.log(`\n${description} ($${base}):`);
    console.log(`  Provider receives: $${fees.providerPayoutCents / 100} (${providerPercent}%)`);
    console.log(`  Platform fee: $${fees.platformFeeCents / 100}`);
    console.log(`  Stripe fee: $${fees.stripeFeeCents / 100}`);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Surge pricing scenarios
  console.log('Test 3: Surge Pricing Scenarios');
  console.log('-'.repeat(30));
  
  const surgeMultipliers = [1.0, 1.25, 1.5, 2.0, 3.0];
  const basePrice = 100;
  
  for (const multiplier of surgeMultipliers) {
    const surgePrice = basePrice * multiplier;
    const surgePriceCents = surgePrice * 100;
    const fees = calculateFees(surgePriceCents, false);
    
    console.log(`\nSurge ${multiplier}x (Base: $${basePrice}):`);
    console.log(`  Dynamic Price: $${surgePrice}`);
    console.log(`  Customer Pays: $${fees.totalCents / 100}`);
    console.log(`  Provider Gets: $${fees.providerPayoutCents / 100}`);
    console.log(`  Platform Revenue: $${fees.platformFeeCents / 100}`);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Group booking pricing
  console.log('Test 4: Group Booking Pricing');
  console.log('-'.repeat(30));
  
  const groupSizes = [1, 2, 5, 10];
  const perPersonPrice = 50;
  
  for (const size of groupSizes) {
    const totalPrice = perPersonPrice * size;
    const totalPriceCents = totalPrice * 100;
    const fees = calculateFees(totalPriceCents, false);
    
    console.log(`\nGroup of ${size} (${perPersonPrice}/person):`);
    console.log(`  Total Base: $${totalPrice}`);
    console.log(`  Customer Pays: $${fees.totalCents / 100}`);
    console.log(`  Provider Gets: $${fees.providerPayoutCents / 100}`);
    console.log(`  Per Person Cost: $${(fees.totalCents / 100 / size).toFixed(2)}`);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 5: Time-based pricing (hourly services)
  console.log('Test 5: Hourly Service Pricing');
  console.log('-'.repeat(30));
  
  const hourlyRate = 75;
  const durations = [30, 60, 90, 120, 240]; // minutes
  
  for (const duration of durations) {
    const hours = duration / 60;
    const totalPrice = hourlyRate * hours;
    const totalPriceCents = Math.round(totalPrice * 100);
    const fees = calculateFees(totalPriceCents, false);
    
    const durationStr = duration >= 60 
      ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? ` ${duration % 60}m` : ''}` 
      : `${duration}m`;
    
    console.log(`\nDuration: ${durationStr} (Rate: $${hourlyRate}/hr):`);
    console.log(`  Service Cost: $${(totalPriceCents / 100).toFixed(2)}`);
    console.log(`  Customer Pays: $${(fees.totalCents / 100).toFixed(2)}`);
    console.log(`  Provider Gets: $${(fees.providerPayoutCents / 100).toFixed(2)}`);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  console.log('✅ Pricing Engine Tests Complete!\n');
}

// Run tests
testPricing().catch(console.error);