/**
 * Simple test script for admin APIs
 * Run with: node scripts/test-admin-apis.js
 * 
 * This script tests the basic functionality of all admin endpoints
 * Make sure to set ADMIN_API_TOKEN environment variable with valid admin token
 */

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
const adminToken = process.env.ADMIN_API_TOKEN;

if (!adminToken) {
  console.error('❌ Please set ADMIN_API_TOKEN environment variable');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${adminToken}`,
  'Content-Type': 'application/json'
};

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`🔍 Testing ${name}...`);
    const response = await fetch(`${baseUrl}${url}`, {
      headers,
      ...options
    });
    
    if (response.ok) {
      console.log(`✅ ${name} - Status: ${response.status}`);
      return await response.json();
    } else {
      console.log(`❌ ${name} - Status: ${response.status}`);
      const error = await response.text();
      console.log(`   Error: ${error}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Admin API Tests');
  console.log('=' .repeat(50));

  // Test Analytics API
  console.log('\n📊 Testing Analytics API');
  await testEndpoint('Analytics - Monthly', '/api/admin/analytics?period=month');
  await testEndpoint('Analytics - Weekly', '/api/admin/analytics?period=week&groupBy=day');
  
  // Test Subscriptions API
  console.log('\n💳 Testing Subscriptions API');
  await testEndpoint('Subscriptions - List All', '/api/admin/subscriptions');
  await testEndpoint('Subscriptions - Active Only', '/api/admin/subscriptions?status=active');
  
  // Test Loyalty API
  console.log('\n⭐ Testing Loyalty API');
  await testEndpoint('Loyalty - Accounts', '/api/admin/loyalty');
  await testEndpoint('Loyalty - Analytics', '/api/admin/loyalty?analytics=true');
  
  // Test Pricing API
  console.log('\n💰 Testing Pricing API');
  await testEndpoint('Pricing - Rules', '/api/admin/pricing');
  await testEndpoint('Pricing - Analytics', '/api/admin/pricing?analytics=true');
  
  // Test POST endpoints with sample data
  console.log('\n📝 Testing POST Operations');
  
  // Test loyalty point adjustment (this would normally require real customer ID)
  const loyaltyAdjustment = {
    action: 'adjust_points',
    customerId: 'test_customer_id',
    points: 100,
    description: 'Test adjustment from admin API test',
    reason: 'adjusted'
  };
  
  await testEndpoint('Loyalty - Adjust Points', '/api/admin/loyalty', {
    method: 'POST',
    body: JSON.stringify(loyaltyAdjustment)
  });
  
  // Test pricing rule creation (this would normally require real provider ID)
  const pricingRule = {
    action: 'create_rule',
    providerId: 'test_provider_id',
    ruleType: 'promotional',
    name: 'Test Admin Rule',
    description: 'Test rule created by admin API test',
    conditions: { test: true },
    priceModifier: 0.9, // 10% discount
    priority: 1
  };
  
  await testEndpoint('Pricing - Create Rule', '/api/admin/pricing', {
    method: 'POST',
    body: JSON.stringify(pricingRule)
  });

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Admin API Tests Completed');
  console.log('\n💡 Note: Some POST tests may fail if test data doesn\'t exist');
  console.log('   This is expected for endpoints requiring valid customer/provider IDs');
}

// Run the tests
runTests().catch(console.error);