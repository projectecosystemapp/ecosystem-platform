import { useCallback, useMemo } from 'react';

/**
 * Performance optimization utilities for the marketplace
 */

// Memoized image optimization helper
export const useImageOptimization = () => {
  return useCallback((src: string, width: number = 400, quality: number = 75) => {
    // Return optimized image URL for different providers
    if (src.includes('unsplash.com')) {
      return `${src}&w=${width}&q=${quality}&auto=format&fit=crop`;
    }
    if (src.includes('images.')) {
      // Generic image optimization
      return `${src}?w=${width}&q=${quality}`;
    }
    return src;
  }, []);
};

// Debounced search optimization
export const useSearchDebounce = (value: string, delay: number = 300) => {
  return useMemo(() => {
    const timer = setTimeout(() => value, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
};

// Virtual scrolling threshold constants
export const VIRTUALIZATION_THRESHOLD = 50;
export const ITEM_HEIGHT = 300;
export const CONTAINER_HEIGHT = 600;

// Memoized category filter
export const useCategoryFilter = (items: any[], category: string) => {
  return useMemo(() => {
    if (category === 'all' || !category) return items;
    return items.filter(item => 
      item.category?.toLowerCase() === category.toLowerCase()
    );
  }, [items, category]);
};

// Optimized sort function
export const useSortedItems = (items: any[], sortBy: string) => {
  return useMemo(() => {
    if (!sortBy || sortBy === 'relevance') return items;
    
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (a.price?.amount || 0) - (b.price?.amount || 0);
        case 'rating':
          return (b.provider?.rating || 0) - (a.provider?.rating || 0);
        case 'distance':
          // Placeholder for distance calculation
          return 0;
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });
  }, [items, sortBy]);
};

// Loading state optimization
export const useLoadingStates = () => {
  return {
    // Staggered loading skeleton
    getSkeletonDelay: useCallback((index: number) => index * 50, []),
    // Progressive loading
    shouldShowSkeleton: useCallback((index: number, isLoading: boolean) => {
      return isLoading || index % 4 === 0;
    }, []),
  };
};

// Intersection Observer for lazy loading
export const useIntersectionObserver = (
  callback: () => void,
  options: IntersectionObserverInit = {}
) => {
  return useCallback((node: HTMLElement | null) => {
    if (!node) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        callback();
      }
    }, {
      threshold: 0.1,
      rootMargin: '100px',
      ...options,
    });
    
    observer.observe(node);
    
    return () => observer.disconnect();
  }, [callback, options]);
};