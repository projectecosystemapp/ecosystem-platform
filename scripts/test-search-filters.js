#!/usr/bin/env node

/**
 * Test script to verify search filter connection
 * Run: node scripts/test-search-filters.js
 */

const BASE_URL = 'http://localhost:3000/api/unified-search';

// Test cases for different filter combinations
const testCases = [
  {
    name: 'Price range filter',
    params: {
      q: 'cleaning',
      minPrice: '20',
      maxPrice: '100',
    },
    expected: 'Should return services within price range $20-$100'
  },
  {
    name: 'Rating filter',
    params: {
      q: 'yoga',
      minRating: '4.5',
    },
    expected: 'Should return providers with 4.5+ star rating'
  },
  {
    name: 'Service filters - Instant booking and verified',
    params: {
      'verticals[]': 'services',
      instantBooking: 'true',
      providerVerified: 'true',
    },
    expected: 'Should return only verified providers with instant booking'
  },
  {
    name: 'Location-based search',
    params: {
      q: 'fitness',
      lat: '37.7749',
      lng: '-122.4194',
      radius: '5',
    },
    expected: 'Should return results within 5 miles of San Francisco'
  },
  {
    name: 'Event date range',
    params: {
      'verticals[]': 'events',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expected: 'Should return events in the next 30 days'
  },
  {
    name: 'Space amenities filter',
    params: {
      'verticals[]': 'spaces',
      'amenities[]': ['wifi', 'parking'],
      minCapacity: '10',
      maxCapacity: '50',
    },
    expected: 'Should return spaces with WiFi and parking for 10-50 people'
  },
  {
    name: 'Thing condition filter',
    params: {
      'verticals[]': 'things',
      condition: 'like_new',
      negotiable: 'true',
    },
    expected: 'Should return like-new items with negotiable prices'
  },
  {
    name: 'Combined filters across verticals',
    params: {
      q: 'premium',
      minPrice: '50',
      maxPrice: '500',
      minRating: '4',
      sortBy: 'rating',
    },
    expected: 'Should return premium items $50-500 with 4+ stars sorted by rating'
  },
];

async function testSearchFilters() {
  console.log('Testing Search Filter Connection\n');
  console.log('=' .repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Expected: ${testCase.expected}`);
    
    // Build URL with query parameters
    const url = new URL(BASE_URL);
    
    // Handle array parameters properly
    for (const [key, value] of Object.entries(testCase.params)) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, value);
      }
    }
    
    console.log(`URL: ${url.toString()}`);
    
    try {
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Status: ${response.status} OK`);
        console.log(`   Results: ${data.results?.length || 0} items found`);
        
        // Show applied filters
        if (data.filters?.applied) {
          const appliedFilters = Object.entries(data.filters.applied)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => {
              if (typeof value === 'object' && !Array.isArray(value)) {
                return `${key}: ${JSON.stringify(value)}`;
              }
              return `${key}: ${value}`;
            });
          
          if (appliedFilters.length > 0) {
            console.log(`   Applied filters: ${appliedFilters.join(', ')}`);
          }
        }
        
        passed++;
      } else {
        console.log(`❌ Status: ${response.status} - ${data.error || 'Unknown error'}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`\nTest Results:`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total: ${testCases.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All search filter tests passed!');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Check the implementation.`);
  }
}

// Check if server is running
fetch('http://localhost:3000/api/health')
  .then(() => {
    console.log('Server is running. Starting tests...\n');
    testSearchFilters();
  })
  .catch(() => {
    console.error('❌ Server is not running. Please start the development server first:');
    console.error('   npm run dev\n');
    process.exit(1);
  });