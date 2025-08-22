/**
 * Redis Service
 * Production-ready Redis client with automatic failover and monitoring
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { 
  REDIS_CONFIGS, 
  RATE_LIMIT_RULES, 
  CACHE_TTL,
  REDIS_KEYS,
  isRedisConfigured,
  validateRedisConfig,
  getRedisStatusMessage
} from '@/config/redis.config';

// Singleton instances
let redisClients: {
  rateLimit?: Redis;
  cache?: Redis;
  session?: Redis;
} = {};

let rateLimiters: Record<string, Ratelimit> = {};

// Initialize Redis clients
export function initializeRedis(): boolean {
  const validation = validateRedisConfig();
  
  if (!validation.isValid) {
    console.error('Redis configuration errors:', validation.errors);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis must be configured in production');
    }
    return false;
  }
  
  if (validation.warnings.length > 0) {
    console.warn('Redis configuration warnings:', validation.warnings);
  }
  
  try {
    // Initialize rate limit Redis
    if (REDIS_CONFIGS.rateLimit.url && REDIS_CONFIGS.rateLimit.token) {
      redisClients.rateLimit = new Redis({
        url: REDIS_CONFIGS.rateLimit.url,
        token: REDIS_CONFIGS.rateLimit.token,
      });
      
      // Initialize rate limiters
      initializeRateLimiters();
    }
    
    // Initialize cache Redis
    if (REDIS_CONFIGS.cache.url && REDIS_CONFIGS.cache.token) {
      redisClients.cache = new Redis({
        url: REDIS_CONFIGS.cache.url,
        token: REDIS_CONFIGS.cache.token,
      });
    }
    
    // Initialize session Redis
    if (REDIS_CONFIGS.session.url && REDIS_CONFIGS.session.token) {
      redisClients.session = new Redis({
        url: REDIS_CONFIGS.session.url,
        token: REDIS_CONFIGS.session.token,
      });
    }
    
    console.log(getRedisStatusMessage());
    return true;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    return false;
  }
}

// Initialize rate limiters for each endpoint type
function initializeRateLimiters() {
  if (!redisClients.rateLimit) return;
  
  Object.entries(RATE_LIMIT_RULES).forEach(([type, config]) => {
    rateLimiters[type] = new Ratelimit({
      redis: redisClients.rateLimit!,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      analytics: config.analytics,
      prefix: config.prefix,
    });
  });
}

// Get rate limiter for specific endpoint type
export function getRateLimiter(type: keyof typeof RATE_LIMIT_RULES): Ratelimit | null {
  if (!isRedisConfigured()) {
    return null;
  }
  
  if (!rateLimiters[type]) {
    console.warn(`Rate limiter not found for type: ${type}`);
    return null;
  }
  
  return rateLimiters[type];
}

// Cache service
export const CacheService = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redisClients.cache) return null;
    
    try {
      const value = await redisClients.cache.get(key);
      return value as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },
  
  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!redisClients.cache) return false;
    
    try {
      if (ttl) {
        await redisClients.cache.setex(key, ttl, JSON.stringify(value));
      } else {
        await redisClients.cache.set(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  },
  
  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    if (!redisClients.cache) return false;
    
    try {
      await redisClients.cache.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  },
  
  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    if (!redisClients.cache) return 0;
    
    try {
      // Note: This is a simplified implementation
      // In production, you might want to use SCAN for large datasets
      const keys = await redisClients.cache.keys(pattern);
      if (keys.length > 0) {
        await redisClients.cache.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error(`Cache clear error for pattern ${pattern}:`, error);
      return 0;
    }
  },
  
  /**
   * Cache provider data
   */
  async cacheProvider(providerId: string, data: any): Promise<boolean> {
    const key = REDIS_KEYS.provider(providerId);
    return this.set(key, data, CACHE_TTL.providerProfile);
  },
  
  /**
   * Get cached provider data
   */
  async getCachedProvider(providerId: string): Promise<any | null> {
    const key = REDIS_KEYS.provider(providerId);
    return this.get(key);
  },
  
  /**
   * Cache search results
   */
  async cacheSearchResults(query: string, results: any[]): Promise<boolean> {
    const key = REDIS_KEYS.search(query);
    return this.set(key, results, CACHE_TTL.searchResults);
  },
  
  /**
   * Get cached search results
   */
  async getCachedSearchResults(query: string): Promise<any[] | null> {
    const key = REDIS_KEYS.search(query);
    return this.get(key);
  },
};

// Session service
export const SessionService = {
  /**
   * Store session data
   */
  async setSession(sessionId: string, data: any, isGuest: boolean = false): Promise<boolean> {
    if (!redisClients.session) return false;
    
    const key = isGuest 
      ? REDIS_KEYS.guestSession(sessionId)
      : REDIS_KEYS.session(sessionId);
    
    const ttl = isGuest 
      ? CACHE_TTL.guestSession 
      : CACHE_TTL.userSession;
    
    try {
      await redisClients.session.setex(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Session set error for ${sessionId}:`, error);
      return false;
    }
  },
  
  /**
   * Get session data
   */
  async getSession(sessionId: string, isGuest: boolean = false): Promise<any | null> {
    if (!redisClients.session) return null;
    
    const key = isGuest 
      ? REDIS_KEYS.guestSession(sessionId)
      : REDIS_KEYS.session(sessionId);
    
    try {
      const data = await redisClients.session.get(key);
      return data ? JSON.parse(data as string) : null;
    } catch (error) {
      console.error(`Session get error for ${sessionId}:`, error);
      return null;
    }
  },
  
  /**
   * Delete session
   */
  async deleteSession(sessionId: string, isGuest: boolean = false): Promise<boolean> {
    if (!redisClients.session) return false;
    
    const key = isGuest 
      ? REDIS_KEYS.guestSession(sessionId)
      : REDIS_KEYS.session(sessionId);
    
    try {
      await redisClients.session.del(key);
      return true;
    } catch (error) {
      console.error(`Session delete error for ${sessionId}:`, error);
      return false;
    }
  },
  
  /**
   * Extend session TTL
   */
  async touchSession(sessionId: string, isGuest: boolean = false): Promise<boolean> {
    if (!redisClients.session) return false;
    
    const key = isGuest 
      ? REDIS_KEYS.guestSession(sessionId)
      : REDIS_KEYS.session(sessionId);
    
    const ttl = isGuest 
      ? CACHE_TTL.guestSession 
      : CACHE_TTL.userSession;
    
    try {
      await redisClients.session.expire(key, ttl);
      return true;
    } catch (error) {
      console.error(`Session touch error for ${sessionId}:`, error);
      return false;
    }
  },
};

// Analytics service
export const AnalyticsService = {
  /**
   * Increment counter
   */
  async increment(metric: string, by: number = 1): Promise<number | null> {
    if (!redisClients.cache) return null;
    
    try {
      const result = await redisClients.cache.incrby(metric, by);
      return result;
    } catch (error) {
      console.error(`Analytics increment error for ${metric}:`, error);
      return null;
    }
  },
  
  /**
   * Track unique visitor
   */
  async trackUnique(set: string, identifier: string): Promise<boolean> {
    if (!redisClients.cache) return false;
    
    try {
      await redisClients.cache.sadd(set, identifier);
      return true;
    } catch (error) {
      console.error(`Analytics track unique error:`, error);
      return false;
    }
  },
  
  /**
   * Get unique count
   */
  async getUniqueCount(set: string): Promise<number> {
    if (!redisClients.cache) return 0;
    
    try {
      const count = await redisClients.cache.scard(set);
      return count || 0;
    } catch (error) {
      console.error(`Analytics unique count error:`, error);
      return 0;
    }
  },
};

// Health monitoring
export const HealthMonitor = {
  /**
   * Check Redis health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    services: {
      rateLimit: boolean;
      cache: boolean;
      session: boolean;
    };
    latency: {
      rateLimit?: number;
      cache?: number;
      session?: number;
    };
  }> {
    const services = {
      rateLimit: false,
      cache: false,
      session: false,
    };
    
    const latency: any = {};
    
    // Check rate limit Redis
    if (redisClients.rateLimit) {
      try {
        const start = Date.now();
        await redisClients.rateLimit.ping();
        latency.rateLimit = Date.now() - start;
        services.rateLimit = true;
      } catch (error) {
        console.error('Rate limit Redis health check failed:', error);
      }
    }
    
    // Check cache Redis
    if (redisClients.cache) {
      try {
        const start = Date.now();
        await redisClients.cache.ping();
        latency.cache = Date.now() - start;
        services.cache = true;
      } catch (error) {
        console.error('Cache Redis health check failed:', error);
      }
    }
    
    // Check session Redis
    if (redisClients.session) {
      try {
        const start = Date.now();
        await redisClients.session.ping();
        latency.session = Date.now() - start;
        services.session = true;
      } catch (error) {
        console.error('Session Redis health check failed:', error);
      }
    }
    
    const healthy = Object.values(services).some(s => s);
    
    return {
      healthy,
      services,
      latency,
    };
  },
  
  /**
   * Get Redis metrics
   */
  async getMetrics(): Promise<any> {
    // This would typically connect to Redis INFO command
    // For Upstash, metrics are available via their dashboard
    return {
      configured: isRedisConfigured(),
      message: getRedisStatusMessage(),
      timestamp: new Date().toISOString(),
    };
  },
};

// Initialize Redis on module load
if (typeof window === 'undefined') {
  initializeRedis();
}

// Export configured status
export { isRedisConfigured, getRedisStatusMessage };