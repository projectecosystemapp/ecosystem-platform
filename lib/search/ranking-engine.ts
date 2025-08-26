/**
 * Search Ranking Engine
 * Implements weighted scoring algorithm per Master PRD §4.4.2
 * 
 * Ranking Signals (Weighted):
 * 1. Provider readiness & compliance (hard filter)
 * 2. Proximity (if location provided)
 * 3. Relevance score (name/services/categories)
 * 4. Conversion proxy (views→bookings rate)
 * 5. Rating & recent reviews recency
 * 6. Supply freshness (recent availability updates)
 * 
 * Weights must be deterministic for consistent results
 */

import { getDistance } from 'geolib';

/**
 * Ranking weights configuration
 * These weights determine the importance of each signal
 * Total should equal 1.0 for normalized scoring
 */
export const RANKING_WEIGHTS = {
  PROXIMITY: 0.25,        // 25% - Distance from search location
  RELEVANCE: 0.25,        // 25% - Text match quality
  CONVERSION: 0.20,       // 20% - Booking conversion rate
  RATING: 0.20,           // 20% - Average rating and review count
  FRESHNESS: 0.10,        // 10% - Recent availability updates
} as const;

/**
 * Score ranges for normalization
 */
const SCORE_RANGES = {
  PROXIMITY: { min: 0, max: 100 },      // 0-100km normalized
  RELEVANCE: { min: 0, max: 1 },        // 0-1 relevance score
  CONVERSION: { min: 0, max: 0.5 },     // 0-50% conversion rate
  RATING: { min: 0, max: 5 },           // 0-5 star rating
  FRESHNESS: { min: 0, max: 30 },       // Days since last update
} as const;

/**
 * Provider data for ranking
 */
export interface ProviderRankingData {
  id: string;
  name: string;
  slug: string;
  categories: string[];
  services: Array<{
    name: string;
    description: string;
    price: number;
  }>;
  location?: {
    latitude: number;
    longitude: number;
  };
  stats: {
    averageRating: number;
    totalReviews: number;
    completedBookings: number;
    totalViews: number;
    conversionRate: number;
    lastAvailabilityUpdate: Date;
    recentReviewCount: number; // Reviews in last 30 days
  };
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  query?: string;                    // Text search query
  categories?: string[];              // Category filters
  location?: {                       // Search location
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  minRating?: number;
  availability?: {
    date: string;
    time: string;
  };
}

/**
 * Ranking result with detailed scores
 */
export interface RankingResult {
  providerId: string;
  totalScore: number;
  scores: {
    proximity: number;
    relevance: number;
    conversion: number;
    rating: number;
    freshness: number;
  };
  normalizedScores: {
    proximity: number;
    relevance: number;
    conversion: number;
    rating: number;
    freshness: number;
  };
  debugInfo?: {
    distance?: number;
    matchedTerms?: string[];
    daysSinceUpdate?: number;
  };
}

/**
 * Main ranking engine class
 */
export class RankingEngine {
  /**
   * Rank providers based on search query and weighted signals
   */
  rank(
    providers: ProviderRankingData[],
    query: SearchQuery,
    options: {
      includeDebugInfo?: boolean;
      boostVerified?: boolean;
      penalizeInactive?: boolean;
    } = {}
  ): RankingResult[] {
    // First, apply hard filters (compliance check)
    const eligibleProviders = this.applyHardFilters(providers, query);
    
    // Calculate individual scores for each provider
    const rankedProviders = eligibleProviders.map(provider => 
      this.calculateProviderScore(provider, query, options)
    );
    
    // Sort by total score (descending)
    rankedProviders.sort((a, b) => b.totalScore - a.totalScore);
    
    return rankedProviders;
  }

  /**
   * Apply hard filters (mandatory requirements)
   */
  private applyHardFilters(
    providers: ProviderRankingData[],
    query: SearchQuery
  ): ProviderRankingData[] {
    return providers.filter(provider => {
      // Must be active
      if (!provider.isActive) return false;
      
      // Category filter
      if (query.categories && query.categories.length > 0) {
        const hasMatchingCategory = query.categories.some(cat =>
          provider.categories.includes(cat)
        );
        if (!hasMatchingCategory) return false;
      }
      
      // Price range filter
      if (query.priceRange) {
        const hasServiceInRange = provider.services.some(service =>
          service.price >= query.priceRange!.min &&
          service.price <= query.priceRange!.max
        );
        if (!hasServiceInRange) return false;
      }
      
      // Minimum rating filter
      if (query.minRating && provider.stats.averageRating < query.minRating) {
        return false;
      }
      
      // Location radius filter
      if (query.location && query.location.radiusKm && provider.location) {
        const distance = this.calculateDistance(
          query.location,
          provider.location
        );
        if (distance > query.location.radiusKm) return false;
      }
      
      return true;
    });
  }

  /**
   * Calculate comprehensive score for a provider
   */
  private calculateProviderScore(
    provider: ProviderRankingData,
    query: SearchQuery,
    options: {
      includeDebugInfo?: boolean;
      boostVerified?: boolean;
      penalizeInactive?: boolean;
    }
  ): RankingResult {
    const scores = {
      proximity: this.calculateProximityScore(provider, query),
      relevance: this.calculateRelevanceScore(provider, query),
      conversion: this.calculateConversionScore(provider),
      rating: this.calculateRatingScore(provider),
      freshness: this.calculateFreshnessScore(provider),
    };
    
    // Normalize scores to 0-1 range
    const normalizedScores = {
      proximity: this.normalize(scores.proximity, SCORE_RANGES.PROXIMITY),
      relevance: this.normalize(scores.relevance, SCORE_RANGES.RELEVANCE),
      conversion: this.normalize(scores.conversion, SCORE_RANGES.CONVERSION),
      rating: this.normalize(scores.rating, SCORE_RANGES.RATING),
      freshness: this.normalize(scores.freshness, SCORE_RANGES.FRESHNESS),
    };
    
    // Calculate weighted total
    let totalScore = 
      normalizedScores.proximity * RANKING_WEIGHTS.PROXIMITY +
      normalizedScores.relevance * RANKING_WEIGHTS.RELEVANCE +
      normalizedScores.conversion * RANKING_WEIGHTS.CONVERSION +
      normalizedScores.rating * RANKING_WEIGHTS.RATING +
      normalizedScores.freshness * RANKING_WEIGHTS.FRESHNESS;
    
    // Apply boost/penalty modifiers
    if (options.boostVerified && provider.isVerified) {
      totalScore *= 1.1; // 10% boost for verified providers
    }
    
    const result: RankingResult = {
      providerId: provider.id,
      totalScore,
      scores,
      normalizedScores,
    };
    
    // Add debug information if requested
    if (options.includeDebugInfo) {
      result.debugInfo = {
        distance: query.location && provider.location
          ? this.calculateDistance(query.location, provider.location)
          : undefined,
        matchedTerms: this.getMatchedTerms(provider, query.query),
        daysSinceUpdate: this.getDaysSinceUpdate(provider.stats.lastAvailabilityUpdate),
      };
    }
    
    return result;
  }

  /**
   * Calculate proximity score based on distance
   */
  private calculateProximityScore(
    provider: ProviderRankingData,
    query: SearchQuery
  ): number {
    if (!query.location || !provider.location) {
      return SCORE_RANGES.PROXIMITY.max / 2; // Neutral score if no location
    }
    
    const distance = this.calculateDistance(query.location, provider.location);
    
    // Inverse distance scoring (closer = higher score)
    // Using logarithmic decay for smooth falloff
    const maxDistance = SCORE_RANGES.PROXIMITY.max;
    if (distance >= maxDistance) return 0;
    
    return maxDistance * (1 - Math.log10(distance + 1) / Math.log10(maxDistance + 1));
  }

  /**
   * Calculate relevance score based on text matching
   */
  private calculateRelevanceScore(
    provider: ProviderRankingData,
    query: SearchQuery
  ): number {
    if (!query.query) {
      return SCORE_RANGES.RELEVANCE.max / 2; // Neutral score if no query
    }
    
    const searchTerms = query.query.toLowerCase().split(/\s+/);
    let matchScore = 0;
    
    // Check name match (highest weight)
    const nameMatches = searchTerms.filter(term =>
      provider.name.toLowerCase().includes(term)
    ).length;
    matchScore += nameMatches * 0.4;
    
    // Check category matches
    const categoryMatches = searchTerms.filter(term =>
      provider.categories.some(cat => cat.toLowerCase().includes(term))
    ).length;
    matchScore += categoryMatches * 0.3;
    
    // Check service matches
    const serviceMatches = searchTerms.filter(term =>
      provider.services.some(service =>
        service.name.toLowerCase().includes(term) ||
        service.description.toLowerCase().includes(term)
      )
    ).length;
    matchScore += serviceMatches * 0.3;
    
    // Normalize to 0-1
    return Math.min(matchScore / searchTerms.length, 1);
  }

  /**
   * Calculate conversion score based on booking rate
   */
  private calculateConversionScore(provider: ProviderRankingData): number {
    // Use pre-calculated conversion rate or calculate from views/bookings
    if (provider.stats.conversionRate) {
      return provider.stats.conversionRate;
    }
    
    if (provider.stats.totalViews === 0) {
      return 0; // No views, no conversion
    }
    
    return provider.stats.completedBookings / provider.stats.totalViews;
  }

  /**
   * Calculate rating score combining average and volume
   */
  private calculateRatingScore(provider: ProviderRankingData): number {
    const { averageRating, totalReviews, recentReviewCount } = provider.stats;
    
    if (totalReviews === 0) {
      return 0; // No reviews
    }
    
    // Base score is the average rating
    let score = averageRating;
    
    // Apply confidence adjustment based on review volume
    // More reviews = more confidence in the rating
    const confidenceFactor = Math.min(totalReviews / 50, 1); // Cap at 50 reviews
    score *= (0.5 + 0.5 * confidenceFactor);
    
    // Boost for recent reviews (shows active service)
    if (recentReviewCount > 0) {
      const recencyBoost = Math.min(recentReviewCount / 10, 0.2); // Up to 20% boost
      score *= (1 + recencyBoost);
    }
    
    return Math.min(score, SCORE_RANGES.RATING.max);
  }

  /**
   * Calculate freshness score based on recent updates
   */
  private calculateFreshnessScore(provider: ProviderRankingData): number {
    const daysSinceUpdate = this.getDaysSinceUpdate(provider.stats.lastAvailabilityUpdate);
    
    // Inverse scoring (more recent = higher score)
    const maxDays = SCORE_RANGES.FRESHNESS.max;
    if (daysSinceUpdate >= maxDays) return 0;
    
    return maxDays - daysSinceUpdate;
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    return getDistance(
      { latitude: point1.latitude, longitude: point1.longitude },
      { latitude: point2.latitude, longitude: point2.longitude }
    ) / 1000; // Convert to kilometers
  }

  /**
   * Get days since last update
   */
  private getDaysSinceUpdate(lastUpdate: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get matched search terms for debugging
   */
  private getMatchedTerms(provider: ProviderRankingData, query?: string): string[] {
    if (!query) return [];
    
    const searchTerms = query.toLowerCase().split(/\s+/);
    const matched: string[] = [];
    
    searchTerms.forEach(term => {
      if (provider.name.toLowerCase().includes(term)) {
        matched.push(`name:${term}`);
      }
      provider.categories.forEach(cat => {
        if (cat.toLowerCase().includes(term)) {
          matched.push(`category:${term}`);
        }
      });
      provider.services.forEach(service => {
        if (service.name.toLowerCase().includes(term)) {
          matched.push(`service:${term}`);
        }
      });
    });
    
    return matched;
  }

  /**
   * Normalize a score to 0-1 range
   */
  private normalize(
    value: number,
    range: { min: number; max: number }
  ): number {
    if (value <= range.min) return 0;
    if (value >= range.max) return 1;
    return (value - range.min) / (range.max - range.min);
  }
}

// Export singleton instance
export const rankingEngine = new RankingEngine();