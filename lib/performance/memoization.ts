/**
 * Advanced Memoization Utilities for Performance Optimization
 * Provides various memoization strategies for expensive computations
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { isEqual } from 'lodash';

// ===============================
// FUNCTION MEMOIZATION
// ===============================

interface MemoizeOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (...args: any[]) => string;
  shouldUpdate?: (oldArgs: any[], newArgs: any[]) => boolean;
}

/**
 * Advanced memoization with TTL and size limits
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: MemoizeOptions = {}
): T {
  const {
    maxSize = 100,
    ttl = 300000, // 5 minutes default
    keyGenerator = (...args) => JSON.stringify(args),
    shouldUpdate = (oldArgs, newArgs) => !isEqual(oldArgs, newArgs)
  } = options;

  const cache = new Map<string, { 
    value: ReturnType<T>; 
    timestamp: number; 
    args: Parameters<T> 
  }>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator(...args);
    const now = Date.now();
    const cached = cache.get(key);

    // Check if cached value is valid
    if (cached && (now - cached.timestamp) < ttl) {
      if (!shouldUpdate(cached.args, args)) {
        return cached.value;
      }
    }

    // Compute new value
    const value = fn(...args);

    // Manage cache size
    if (cache.size >= maxSize) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    // Cache new value
    cache.set(key, { value, timestamp: now, args });
    return value;
  }) as T;
}

/**
 * Weak memoization using WeakMap (for object keys)
 */
export function weakMemoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new WeakMap();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = args[0]; // First argument must be an object
    
    if (typeof key !== 'object' || key === null) {
      return fn(...args);
    }

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// ===============================
// REACT HOOKS FOR MEMOIZATION
// ===============================

/**
 * Enhanced useMemo with deep equality checking
 */
export function useDeepMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const prevDeps = useRef<React.DependencyList>();
  const memoizedValue = useRef<T>();

  const hasChanged = !prevDeps.current || 
    deps.length !== prevDeps.current.length ||
    deps.some((dep, index) => !isEqual(dep, prevDeps.current![index]));

  if (hasChanged) {
    memoizedValue.current = factory();
    prevDeps.current = deps;
  }

  return memoizedValue.current!;
}

/**
 * Memoized callback with stable reference
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps?: React.DependencyList
): T {
  const callbackRef = useRef<T>(callback);
  const stableCallback = useRef<T>();

  useEffect(() => {
    callbackRef.current = callback;
  });

  if (!stableCallback.current) {
    stableCallback.current = ((...args) => {
      return callbackRef.current(...args);
    }) as T;
  }

  return stableCallback.current;
}

/**
 * Async memoization hook
 */
export function useAsyncMemo<T>(
  asyncFactory: () => Promise<T>,
  deps: React.DependencyList,
  initialValue?: T
): { data: T | undefined; loading: boolean; error: Error | null } {
  const [state, setState] = useState<{
    data: T | undefined;
    loading: boolean;
    error: Error | null;
  }>({
    data: initialValue,
    loading: true,
    error: null
  });

  const depsString = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    
    setState(prev => ({ ...prev, loading: true, error: null }));

    asyncFactory()
      .then(data => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setState(prev => ({ ...prev, loading: false, error }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [depsString]);

  return state;
}

// ===============================
// COMPUTATION MEMOIZERS
// ===============================

/**
 * Memoize expensive calculations
 */
export class ComputationMemoizer {
  private static cache = new Map<string, { result: any; timestamp: number }>();
  private static readonly TTL = 600000; // 10 minutes

  static memoize<T>(
    key: string,
    computation: () => T,
    ttl: number = this.TTL
  ): T {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < ttl) {
      return cached.result;
    }

    const result = computation();
    this.cache.set(key, { result, timestamp: now });
    
    // Cleanup old entries
    this.cleanup();
    
    return result;
  }

  private static cleanup(): void {
    const now = Date.now();
    for (const [key, { timestamp }] of this.cache.entries()) {
      if (now - timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }

  static clear(): void {
    this.cache.clear();
  }

  static size(): number {
    return this.cache.size;
  }
}

// ===============================
// SPECIALIZED MEMOIZERS
// ===============================

/**
 * Memoize search results
 */
export const memoizeSearch = memoize(
  (query: string, filters: any, page: number) => {
    // This would be the actual search function
    return { query, filters, page, results: [] };
  },
  {
    maxSize: 50,
    ttl: 300000, // 5 minutes
    keyGenerator: (query, filters, page) => 
      `search:${query}:${JSON.stringify(filters)}:${page}`
  }
);

/**
 * Memoize API responses
 */
export const memoizeApiCall = memoize(
  async (endpoint: string, params: any) => {
    // This would be the actual API call
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return response.json();
  },
  {
    maxSize: 100,
    ttl: 180000, // 3 minutes
    keyGenerator: (endpoint, params) => 
      `api:${endpoint}:${JSON.stringify(params)}`
  }
);

/**
 * Memoize provider availability calculations
 */
export const memoizeAvailability = memoize(
  (providerId: string, date: Date, duration: number) => {
    // This would be the actual availability calculation
    const dateStr = date.toISOString().split('T')[0];
    return ComputationMemoizer.memoize(
      `availability:${providerId}:${dateStr}:${duration}`,
      () => {
        // Expensive availability calculation here
        return {
          providerId,
          date: dateStr,
          slots: [],
          duration
        };
      }
    );
  },
  {
    maxSize: 200,
    ttl: 120000, // 2 minutes (availability changes frequently)
    keyGenerator: (providerId, date, duration) => 
      `avail:${providerId}:${date.toISOString().split('T')[0]}:${duration}`
  }
);

/**
 * Memoize price calculations
 */
export const memoizePricing = memoize(
  (basePrice: number, duration: number, discounts: any[], surcharges: any[]) => {
    return ComputationMemoizer.memoize(
      `pricing:${basePrice}:${duration}:${JSON.stringify(discounts)}:${JSON.stringify(surcharges)}`,
      () => {
        // Complex pricing calculation
        let total = basePrice * duration;
        
        // Apply discounts
        discounts.forEach(discount => {
          if (discount.type === 'percentage') {
            total *= (1 - discount.value / 100);
          } else {
            total -= discount.value;
          }
        });
        
        // Apply surcharges
        surcharges.forEach(surcharge => {
          if (surcharge.type === 'percentage') {
            total *= (1 + surcharge.value / 100);
          } else {
            total += surcharge.value;
          }
        });
        
        return {
          basePrice,
          duration,
          discounts,
          surcharges,
          total: Math.round(total * 100) / 100
        };
      }
    );
  },
  {
    maxSize: 500,
    ttl: 1800000, // 30 minutes (pricing rules don't change often)
  }
);

// ===============================
// MEMOIZATION DECORATORS
// ===============================

/**
 * Class method decorator for memoization
 */
export function Memoized(options: MemoizeOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const memoizedMethod = memoize(originalMethod, options);
    descriptor.value = memoizedMethod;
    return descriptor;
  };
}

/**
 * Class property decorator for lazy initialization
 */
export function Lazy<T>(initializer: () => T) {
  return function (target: any, propertyKey: string) {
    const symbol = Symbol(propertyKey);
    
    Object.defineProperty(target, propertyKey, {
      get() {
        if (!this[symbol]) {
          this[symbol] = initializer();
        }
        return this[symbol];
      },
      set(value: T) {
        this[symbol] = value;
      },
      enumerable: true,
      configurable: true
    });
  };
}

// ===============================
// PERFORMANCE MONITORING
// ===============================

/**
 * Memoization performance tracker
 */
export class MemoizationTracker {
  private static metrics = new Map<string, {
    hits: number;
    misses: number;
    computationTime: number;
    cacheTime: number;
  }>();

  static trackCall(
    key: string,
    wasHit: boolean,
    executionTime: number
  ): void {
    const metric = this.metrics.get(key) || {
      hits: 0,
      misses: 0,
      computationTime: 0,
      cacheTime: 0
    };

    if (wasHit) {
      metric.hits++;
      metric.cacheTime += executionTime;
    } else {
      metric.misses++;
      metric.computationTime += executionTime;
    }

    this.metrics.set(key, metric);
  }

  static getMetrics(key?: string) {
    if (key) {
      return this.metrics.get(key);
    }
    return Object.fromEntries(this.metrics.entries());
  }

  static getHitRate(key: string): number {
    const metric = this.metrics.get(key);
    if (!metric) return 0;
    
    const total = metric.hits + metric.misses;
    return total > 0 ? metric.hits / total : 0;
  }

  static clear(): void {
    this.metrics.clear();
  }
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Create a memoized selector for data transformations
 */
export function createSelector<TInput, TOutput>(
  selector: (input: TInput) => TOutput,
  equalityFn: (a: TInput, b: TInput) => boolean = isEqual
): (input: TInput) => TOutput {
  let lastInput: TInput;
  let lastOutput: TOutput;
  let hasRun = false;

  return (input: TInput) => {
    if (!hasRun || !equalityFn(input, lastInput)) {
      lastInput = input;
      lastOutput = selector(input);
      hasRun = true;
    }
    return lastOutput;
  };
}

/**
 * Batch memoization for multiple function calls
 */
export function batchMemoize<T extends Record<string, (...args: any[]) => any>>(
  functions: T,
  options: MemoizeOptions = {}
): T {
  const memoized = {} as T;
  
  for (const [key, fn] of Object.entries(functions)) {
    memoized[key as keyof T] = memoize(fn, options);
  }
  
  return memoized;
}

// React imports (should be at the top in real implementation)
import { useState, useEffect, useRef } from 'react';