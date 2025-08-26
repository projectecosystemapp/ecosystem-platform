/**
 * Search and Ranking Engine Test Suite
 * Tests weighted scoring algorithm, deterministic results, cache operations,
 * filter applications, and provider stats calculations
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RankingEngine, RANKING_WEIGHTS, type ProviderRankingData, type SearchQuery } from '@/lib/search/ranking-engine';

describe('RankingEngine', () => {
  let rankingEngine: RankingEngine;
  let mockProviders: ProviderRankingData[];

  beforeEach(() => {
    rankingEngine = new RankingEngine();

    // Create comprehensive test data
    mockProviders = [
      {
        id: 'provider-1',
        name: 'Downtown Yoga Studio',
        slug: 'downtown-yoga',
        categories: ['fitness', 'wellness'],
        services: [
          { name: 'Beginner Yoga', description: 'Perfect for new practitioners', price: 25 },
          { name: 'Advanced Yoga', description: 'Challenging poses for experienced yogis', price: 35 },
        ],
        location: { latitude: 40.7128, longitude: -74.0060 }, // NYC
        stats: {
          averageRating: 4.8,
          totalReviews: 150,
          completedBookings: 500,
          totalViews: 2000,
          conversionRate: 0.25,
          lastAvailabilityUpdate: new Date('2024-01-15'),
          recentReviewCount: 20,
        },
        isVerified: true,
        isActive: true,
        createdAt: new Date('2023-01-01'),
      },
      {
        id: 'provider-2',
        name: 'Brooklyn Fitness Center',
        slug: 'brooklyn-fitness',
        categories: ['fitness', 'strength'],
        services: [
          { name: 'Personal Training', description: 'One-on-one fitness coaching', price: 80 },
          { name: 'Group Classes', description: 'High-energy group workouts', price: 20 },
        ],
        location: { latitude: 40.6782, longitude: -73.9442 }, // Brooklyn
        stats: {
          averageRating: 4.5,
          totalReviews: 75,
          completedBookings: 300,
          totalViews: 1500,
          conversionRate: 0.20,
          lastAvailabilityUpdate: new Date('2024-01-10'),
          recentReviewCount: 10,
        },
        isVerified: false,
        isActive: true,
        createdAt: new Date('2023-06-01'),
      },
      {
        id: 'provider-3',
        name: 'Manhattan Spa & Wellness',
        slug: 'manhattan-spa',
        categories: ['wellness', 'beauty'],
        services: [
          { name: 'Massage Therapy', description: 'Relaxing full-body massage', price: 120 },
          { name: 'Facial Treatment', description: 'Rejuvenating skincare service', price: 90 },
        ],
        location: { latitude: 40.7589, longitude: -73.9851 }, // Manhattan
        stats: {
          averageRating: 4.9,
          totalReviews: 200,
          completedBookings: 800,
          totalViews: 3200,
          conversionRate: 0.25,
          lastAvailabilityUpdate: new Date('2024-01-20'),
          recentReviewCount: 30,
        },
        isVerified: true,
        isActive: true,
        createdAt: new Date('2022-01-01'),
      },
      {
        id: 'provider-4',
        name: 'Queens Boxing Gym',
        slug: 'queens-boxing',
        categories: ['fitness', 'martial-arts'],
        services: [
          { name: 'Boxing Classes', description: 'Learn proper boxing technique', price: 40 },
          { name: 'Personal Boxing', description: 'One-on-one boxing training', price: 60 },
        ],
        location: { latitude: 40.7282, longitude: -73.7949 }, // Queens
        stats: {
          averageRating: 4.2,
          totalReviews: 50,
          completedBookings: 200,
          totalViews: 1000,
          conversionRate: 0.20,
          lastAvailabilityUpdate: new Date('2024-01-05'),
          recentReviewCount: 5,
        },
        isVerified: false,
        isActive: true,
        createdAt: new Date('2023-03-01'),
      },
      {
        id: 'provider-5',
        name: 'Inactive Provider',
        slug: 'inactive-provider',
        categories: ['wellness'],
        services: [
          { name: 'Test Service', description: 'Should not appear', price: 50 },
        ],
        location: { latitude: 40.7128, longitude: -74.0060 },
        stats: {
          averageRating: 3.0,
          totalReviews: 10,
          completedBookings: 50,
          totalViews: 100,
          conversionRate: 0.50,
          lastAvailabilityUpdate: new Date('2023-12-01'),
          recentReviewCount: 0,
        },
        isVerified: false,
        isActive: false, // Inactive - should be filtered out
        createdAt: new Date('2023-01-01'),
      },
    ];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Weighted Scoring Algorithm', () => {
    it('should calculate scores using defined weights', () => {
      const query: SearchQuery = {
        query: 'yoga',
        location: { latitude: 40.7128, longitude: -74.0060 }, // NYC center
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      // Should find the yoga provider
      const yogaProvider = results.find(r => r.providerId === 'provider-1');
      expect(yogaProvider).toBeDefined();

      // Verify all score components are calculated
      expect(yogaProvider!.scores.proximity).toBeDefined();
      expect(yogaProvider!.scores.relevance).toBeDefined();
      expect(yogaProvider!.scores.conversion).toBeDefined();
      expect(yogaProvider!.scores.rating).toBeDefined();
      expect(yogaProvider!.scores.freshness).toBeDefined();

      // Verify normalized scores are between 0 and 1
      Object.values(yogaProvider!.normalizedScores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should weight proximity correctly', () => {
      const nearQuery: SearchQuery = {
        location: { latitude: 40.7128, longitude: -74.0060 }, // NYC center
      };

      const results = rankingEngine.rank(mockProviders, nearQuery);

      // Provider-1 (Downtown Yoga) should rank higher due to proximity
      const provider1Rank = results.findIndex(r => r.providerId === 'provider-1');
      const provider4Rank = results.findIndex(r => r.providerId === 'provider-4'); // Queens - farther

      expect(provider1Rank).toBeLessThan(provider4Rank);
    });

    it('should weight relevance correctly for text queries', () => {
      const query: SearchQuery = {
        query: 'yoga meditation wellness',
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      // Provider-1 (yoga) should have higher relevance than provider-4 (boxing)
      const yogaProvider = results.find(r => r.providerId === 'provider-1');
      const boxingProvider = results.find(r => r.providerId === 'provider-4');

      expect(yogaProvider!.scores.relevance).toBeGreaterThan(boxingProvider!.scores.relevance);
    });

    it('should weight conversion rate correctly', () => {
      const query: SearchQuery = {};

      const results = rankingEngine.rank(mockProviders, query);

      // Provider-3 and Provider-1 have higher conversion rates (0.25)
      const highConversionProviders = results.slice(0, 2);
      const highConversionIds = highConversionProviders.map(p => p.providerId);

      expect(highConversionIds).toContain('provider-1');
      expect(highConversionIds).toContain('provider-3');
    });

    it('should weight rating with review volume confidence', () => {
      const query: SearchQuery = {};

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      // Provider-3 has highest rating (4.9) with good review count (200)
      const provider3 = results.find(r => r.providerId === 'provider-3');
      const provider4 = results.find(r => r.providerId === 'provider-4'); // Lower rating (4.2) and fewer reviews (50)

      expect(provider3!.scores.rating).toBeGreaterThan(provider4!.scores.rating);
    });

    it('should weight freshness based on recent updates', () => {
      const query: SearchQuery = {};

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      // Provider-3 has most recent update (2024-01-20)
      const provider3 = results.find(r => r.providerId === 'provider-3');
      const provider4 = results.find(r => r.providerId === 'provider-4'); // Older update (2024-01-05)

      expect(provider3!.scores.freshness).toBeGreaterThan(provider4!.scores.freshness);
    });
  });

  describe('Deterministic Results', () => {
    it('should produce consistent ranking for same inputs', () => {
      const query: SearchQuery = {
        query: 'fitness',
        location: { latitude: 40.7128, longitude: -74.0060 },
      };

      const results1 = rankingEngine.rank(mockProviders, query);
      const results2 = rankingEngine.rank(mockProviders, query);

      expect(results1).toEqual(results2);
    });

    it('should handle empty query consistently', () => {
      const emptyQuery: SearchQuery = {};

      const results1 = rankingEngine.rank(mockProviders, emptyQuery);
      const results2 = rankingEngine.rank(mockProviders, emptyQuery);

      expect(results1.map(r => r.providerId)).toEqual(results2.map(r => r.providerId));
      expect(results1.map(r => r.totalScore)).toEqual(results2.map(r => r.totalScore));
    });

    it('should maintain order stability for tied scores', () => {
      // Create providers with identical stats to test tie-breaking
      const identicalProviders = [
        { ...mockProviders[0], id: 'identical-1' },
        { ...mockProviders[0], id: 'identical-2' },
        { ...mockProviders[0], id: 'identical-3' },
      ];

      const query: SearchQuery = {};
      const results1 = rankingEngine.rank(identicalProviders, query);
      const results2 = rankingEngine.rank(identicalProviders, query);

      expect(results1.map(r => r.providerId)).toEqual(results2.map(r => r.providerId));
    });
  });

  describe('Hard Filters', () => {
    it('should filter out inactive providers', () => {
      const query: SearchQuery = {};

      const results = rankingEngine.rank(mockProviders, query);

      const inactiveProvider = results.find(r => r.providerId === 'provider-5');
      expect(inactiveProvider).toBeUndefined();
    });

    it('should filter by categories', () => {
      const query: SearchQuery = {
        categories: ['wellness'],
      };

      const results = rankingEngine.rank(mockProviders, query);

      // Should only include providers with wellness category
      const resultIds = results.map(r => r.providerId);
      expect(resultIds).toContain('provider-1'); // fitness, wellness
      expect(resultIds).toContain('provider-3'); // wellness, beauty
      expect(resultIds).not.toContain('provider-4'); // fitness, martial-arts (no wellness)
    });

    it('should filter by price range', () => {
      const query: SearchQuery = {
        priceRange: { min: 50, max: 100 },
      };

      const results = rankingEngine.rank(mockProviders, query);

      // Should only include providers with services in range
      const resultIds = results.map(r => r.providerId);
      expect(resultIds).toContain('provider-2'); // Has $80 service
      expect(resultIds).toContain('provider-3'); // Has $90 service
      expect(resultIds).toContain('provider-4'); // Has $60 service
      expect(resultIds).not.toContain('provider-1'); // All services under $50
    });

    it('should filter by minimum rating', () => {
      const query: SearchQuery = {
        minRating: 4.6,
      };

      const results = rankingEngine.rank(mockProviders, query);

      // Should only include high-rated providers
      const resultIds = results.map(r => r.providerId);
      expect(resultIds).toContain('provider-1'); // 4.8 rating
      expect(resultIds).toContain('provider-3'); // 4.9 rating
      expect(resultIds).not.toContain('provider-2'); // 4.5 rating
      expect(resultIds).not.toContain('provider-4'); // 4.2 rating
    });

    it('should filter by location radius', () => {
      const query: SearchQuery = {
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          radiusKm: 10, // 10km radius from NYC center
        },
      };

      const results = rankingEngine.rank(mockProviders, query);

      // Should include nearby providers, exclude distant ones
      const resultIds = results.map(r => r.providerId);
      expect(resultIds.length).toBeGreaterThan(0);
      expect(resultIds.length).toBeLessThan(mockProviders.filter(p => p.isActive).length);
    });

    it('should combine multiple filters', () => {
      const query: SearchQuery = {
        categories: ['fitness'],
        priceRange: { min: 30, max: 70 },
        minRating: 4.0,
      };

      const results = rankingEngine.rank(mockProviders, query);

      // Should apply all filters
      const resultIds = results.map(r => r.providerId);
      expect(resultIds).toContain('provider-4'); // fitness, $40-60 services, 4.2 rating
      expect(resultIds).not.toContain('provider-3'); // no fitness category
    });
  });

  describe('Search Query Processing', () => {
    it('should match provider names', () => {
      const query: SearchQuery = {
        query: 'Downtown',
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      const downtownProvider = results.find(r => r.providerId === 'provider-1');
      expect(downtownProvider).toBeDefined();
      expect(downtownProvider!.debugInfo?.matchedTerms).toContain('name:downtown');
    });

    it('should match service names and descriptions', () => {
      const query: SearchQuery = {
        query: 'massage',
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      const spaProvider = results.find(r => r.providerId === 'provider-3');
      expect(spaProvider).toBeDefined();
      expect(spaProvider!.scores.relevance).toBeGreaterThan(0);
    });

    it('should match categories', () => {
      const query: SearchQuery = {
        query: 'wellness',
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      // Should match providers with wellness category
      const wellnessProviders = results.filter(r => 
        r.debugInfo?.matchedTerms?.some(term => term.includes('category:wellness'))
      );
      expect(wellnessProviders.length).toBeGreaterThan(0);
    });

    it('should handle multi-word queries', () => {
      const query: SearchQuery = {
        query: 'yoga fitness wellness',
      };

      const results = rankingEngine.rank(mockProviders, query);

      // Should rank providers with multiple matches higher
      expect(results[0].scores.relevance).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const query1: SearchQuery = { query: 'YOGA' };
      const query2: SearchQuery = { query: 'yoga' };
      const query3: SearchQuery = { query: 'Yoga' };

      const results1 = rankingEngine.rank(mockProviders, query1);
      const results2 = rankingEngine.rank(mockProviders, query2);
      const results3 = rankingEngine.rank(mockProviders, query3);

      expect(results1).toEqual(results2);
      expect(results2).toEqual(results3);
    });
  });

  describe('Provider Statistics', () => {
    it('should calculate conversion rates correctly', () => {
      const query: SearchQuery = {};

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      results.forEach(result => {
        const provider = mockProviders.find(p => p.id === result.providerId)!;
        const expectedConversion = provider.stats.conversionRate || 
          (provider.stats.completedBookings / provider.stats.totalViews);
        
        expect(result.scores.conversion).toBeCloseTo(expectedConversion, 2);
      });
    });

    it('should handle providers with no views correctly', () => {
      const providerWithNoViews: ProviderRankingData = {
        ...mockProviders[0],
        id: 'no-views-provider',
        stats: {
          ...mockProviders[0].stats,
          totalViews: 0,
          completedBookings: 0,
          conversionRate: 0,
        },
      };

      const results = rankingEngine.rank([providerWithNoViews], {});

      expect(results[0].scores.conversion).toBe(0);
    });

    it('should apply confidence adjustments for rating scores', () => {
      const highReviewProvider: ProviderRankingData = {
        ...mockProviders[0],
        id: 'high-review-provider',
        stats: {
          ...mockProviders[0].stats,
          averageRating: 4.5,
          totalReviews: 100,
          recentReviewCount: 15,
        },
      };

      const lowReviewProvider: ProviderRankingData = {
        ...mockProviders[0],
        id: 'low-review-provider',
        stats: {
          ...mockProviders[0].stats,
          averageRating: 4.5, // Same rating
          totalReviews: 5,    // Much fewer reviews
          recentReviewCount: 1,
        },
      };

      const results = rankingEngine.rank([highReviewProvider, lowReviewProvider], {});

      const highReviewResult = results.find(r => r.providerId === 'high-review-provider');
      const lowReviewResult = results.find(r => r.providerId === 'low-review-provider');

      // High review count should boost confidence
      expect(highReviewResult!.scores.rating).toBeGreaterThan(lowReviewResult!.scores.rating);
    });

    it('should boost providers with recent reviews', () => {
      const recentReviewProvider: ProviderRankingData = {
        ...mockProviders[0],
        id: 'recent-review-provider',
        stats: {
          ...mockProviders[0].stats,
          averageRating: 4.0,
          totalReviews: 50,
          recentReviewCount: 15, // Many recent reviews
        },
      };

      const oldReviewProvider: ProviderRankingData = {
        ...mockProviders[0],
        id: 'old-review-provider',
        stats: {
          ...mockProviders[0].stats,
          averageRating: 4.0,
          totalReviews: 50,
          recentReviewCount: 0, // No recent reviews
        },
      };

      const results = rankingEngine.rank([recentReviewProvider, oldReviewProvider], {});

      const recentResult = results.find(r => r.providerId === 'recent-review-provider');
      const oldResult = results.find(r => r.providerId === 'old-review-provider');

      expect(recentResult!.scores.rating).toBeGreaterThan(oldResult!.scores.rating);
    });
  });

  describe('Boost and Penalty Options', () => {
    it('should boost verified providers when enabled', () => {
      const query: SearchQuery = {};
      
      const resultsWithBoost = rankingEngine.rank(mockProviders, query, { boostVerified: true });
      const resultsWithoutBoost = rankingEngine.rank(mockProviders, query, { boostVerified: false });

      // Provider-1 and Provider-3 are verified
      const verifiedWithBoost = resultsWithBoost.find(r => r.providerId === 'provider-1');
      const verifiedWithoutBoost = resultsWithoutBoost.find(r => r.providerId === 'provider-1');

      expect(verifiedWithBoost!.totalScore).toBeGreaterThan(verifiedWithoutBoost!.totalScore);
    });

    it('should not penalize already-filtered inactive providers', () => {
      const query: SearchQuery = {};
      
      const results = rankingEngine.rank(mockProviders, query, { penalizeInactive: true });

      // Inactive providers should already be filtered out
      const inactiveProvider = results.find(r => r.providerId === 'provider-5');
      expect(inactiveProvider).toBeUndefined();
    });
  });

  describe('Distance Calculations', () => {
    it('should calculate proximity scores based on distance', () => {
      const centerQuery: SearchQuery = {
        location: { latitude: 40.7128, longitude: -74.0060 }, // NYC center
      };

      const results = rankingEngine.rank(mockProviders, centerQuery, { includeDebugInfo: true });

      // Check distance calculations
      results.forEach(result => {
        expect(result.debugInfo?.distance).toBeDefined();
        expect(result.debugInfo!.distance!).toBeGreaterThanOrEqual(0);
      });

      // Closer providers should have higher proximity scores
      const sortedByDistance = results.sort((a, b) => 
        (a.debugInfo?.distance || 0) - (b.debugInfo?.distance || 0)
      );
      
      const closest = sortedByDistance[0];
      const furthest = sortedByDistance[sortedByDistance.length - 1];
      
      expect(closest.scores.proximity).toBeGreaterThanOrEqual(furthest.scores.proximity);
    });

    it('should handle providers without location', () => {
      const providerWithoutLocation: ProviderRankingData = {
        ...mockProviders[0],
        id: 'no-location-provider',
        location: undefined,
      };

      const query: SearchQuery = {
        location: { latitude: 40.7128, longitude: -74.0060 },
      };

      const results = rankingEngine.rank([providerWithoutLocation], query, { includeDebugInfo: true });

      const result = results[0];
      expect(result.debugInfo?.distance).toBeUndefined();
      expect(result.scores.proximity).toBeGreaterThan(0); // Should get neutral score
    });
  });

  describe('Debug Information', () => {
    it('should include debug info when requested', () => {
      const query: SearchQuery = {
        query: 'yoga',
        location: { latitude: 40.7128, longitude: -74.0060 },
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      results.forEach(result => {
        expect(result.debugInfo).toBeDefined();
        expect(result.debugInfo!.matchedTerms).toBeDefined();
        expect(result.debugInfo!.daysSinceUpdate).toBeDefined();
      });
    });

    it('should not include debug info when not requested', () => {
      const query: SearchQuery = {
        query: 'yoga',
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: false });

      results.forEach(result => {
        expect(result.debugInfo).toBeUndefined();
      });
    });

    it('should track matched search terms', () => {
      const query: SearchQuery = {
        query: 'yoga fitness downtown',
      };

      const results = rankingEngine.rank(mockProviders, query, { includeDebugInfo: true });

      const yogaProvider = results.find(r => r.providerId === 'provider-1');
      expect(yogaProvider!.debugInfo!.matchedTerms).toContain('name:downtown');
      expect(yogaProvider!.debugInfo!.matchedTerms).toContain('category:fitness');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty provider list', () => {
      const query: SearchQuery = { query: 'test' };
      
      const results = rankingEngine.rank([], query);

      expect(results).toEqual([]);
    });

    it('should handle providers with zero stats', () => {
      const zeroStatsProvider: ProviderRankingData = {
        ...mockProviders[0],
        id: 'zero-stats-provider',
        stats: {
          averageRating: 0,
          totalReviews: 0,
          completedBookings: 0,
          totalViews: 0,
          conversionRate: 0,
          lastAvailabilityUpdate: new Date('2024-01-01'),
          recentReviewCount: 0,
        },
      };

      const results = rankingEngine.rank([zeroStatsProvider], {});

      expect(results).toHaveLength(1);
      expect(results[0].totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle extreme distances gracefully', () => {
      const query: SearchQuery = {
        location: { latitude: 0, longitude: 0 }, // Equator
      };

      const results = rankingEngine.rank(mockProviders, query);

      // Should still return results without errors
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
        expect(result.scores.proximity).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle very old last update dates', () => {
      const oldProvider: ProviderRankingData = {
        ...mockProviders[0],
        id: 'old-provider',
        stats: {
          ...mockProviders[0].stats,
          lastAvailabilityUpdate: new Date('2020-01-01'), // Very old
        },
      };

      const results = rankingEngine.rank([oldProvider], {});

      expect(results[0].scores.freshness).toBe(0); // Should get minimum freshness score
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large provider lists efficiently', () => {
      // Create a large number of providers
      const largeProviderList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockProviders[0],
        id: `provider-${i}`,
        name: `Provider ${i}`,
      }));

      const startTime = Date.now();
      const results = rankingEngine.rank(largeProviderList, { query: 'test' });
      const endTime = Date.now();

      expect(results).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain consistent performance with complex queries', () => {
      const complexQuery: SearchQuery = {
        query: 'yoga fitness wellness massage therapy downtown brooklyn',
        location: { latitude: 40.7128, longitude: -74.0060 },
        categories: ['fitness', 'wellness'],
        priceRange: { min: 20, max: 100 },
        minRating: 4.0,
      };

      const startTime = Date.now();
      const results = rankingEngine.rank(mockProviders, complexQuery, { 
        includeDebugInfo: true,
        boostVerified: true,
      });
      const endTime = Date.now();

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});