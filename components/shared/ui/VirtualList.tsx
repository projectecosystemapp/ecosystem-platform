"use client";

import { useRef, useState, useEffect, useCallback, memo, ReactNode } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export const VirtualList = memo(function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 3,
  className = "",
  onEndReached,
  endReachedThreshold = 100,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // Calculate item heights
  const getItemHeight = useCallback((index: number) => {
    return typeof itemHeight === "function" ? itemHeight(index) : itemHeight;
  }, [itemHeight]);

  // Calculate total height
  const totalHeight = items.reduce((acc, _, index) => {
    return acc + getItemHeight(index);
  }, 0);

  // Calculate visible range
  const getVisibleRange = useCallback(() => {
    if (!containerHeight) return { start: 0, end: 0 };

    let accumulatedHeight = 0;
    let start = 0;
    let end = items.length - 1;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      if (accumulatedHeight + height > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += height;
    }

    // Find end index
    accumulatedHeight = 0;
    for (let i = start; i < items.length; i++) {
      if (accumulatedHeight > scrollTop + containerHeight) {
        end = Math.min(items.length - 1, i + overscan);
        break;
      }
      accumulatedHeight += getItemHeight(i);
    }

    return { start, end };
  }, [scrollTop, containerHeight, items.length, getItemHeight, overscan]);

  const { start, end } = getVisibleRange();

  // Calculate offset for visible items
  const getItemOffset = useCallback((index: number) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i);
    }
    return offset;
  }, [getItemHeight]);

  // Handle scroll
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);

    // Check if end reached
    if (onEndReached) {
      const distanceFromBottom = totalHeight - (target.scrollTop + containerHeight);
      if (distanceFromBottom <= endReachedThreshold) {
        onEndReached();
      }
    }
  }, [containerHeight, totalHeight, endReachedThreshold, onEndReached]);

  // Debounced scroll handler for performance
  const debouncedScrollTop = useDebounce(scrollTop, 10);

  // Handle resize
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight);
    }
  }, []);

  // Setup scroll listener
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) return;

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Setup resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    handleResize(); // Initial measurement

    return () => resizeObserver.disconnect();
  }, [handleResize]);

  // Render visible items
  const visibleItems = [];
  for (let i = start; i <= end; i++) {
    const item = items[i];
    if (!item) continue;

    visibleItems.push(
      <div
        key={i}
        style={{
          position: "absolute",
          top: getItemOffset(i),
          left: 0,
          right: 0,
          height: getItemHeight(i),
        }}
        role="listitem"
      >
        {renderItem(item, i)}
      </div>
    );
  }

  return (
    <div
      ref={scrollElementRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: "100%" }}
      role="list"
      aria-label="Virtual scrolling list"
      aria-rowcount={items.length}
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          height: totalHeight,
          width: "100%",
        }}
        aria-hidden="true"
      >
        {visibleItems}
      </div>
    </div>
  );
}) as <T>(props: VirtualListProps<T>) => JSX.Element;

// Hook for using virtual scrolling
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
}: {
  items: T[];
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const getItemHeight = useCallback((index: number) => {
    return typeof itemHeight === "function" ? itemHeight(index) : itemHeight;
  }, [itemHeight]);

  const totalHeight = items.reduce((acc, _, index) => {
    return acc + getItemHeight(index);
  }, 0);

  const visibleRange = useCallback(() => {
    if (!containerHeight) return { start: 0, end: 0 };

    let accumulatedHeight = 0;
    let start = 0;
    let end = items.length - 1;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      if (accumulatedHeight + height > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += height;
    }

    // Find end index
    accumulatedHeight = 0;
    for (let i = start; i < items.length; i++) {
      if (accumulatedHeight > scrollTop + containerHeight) {
        end = Math.min(items.length - 1, i + overscan);
        break;
      }
      accumulatedHeight += getItemHeight(i);
    }

    return { start, end };
  }, [scrollTop, containerHeight, items.length, getItemHeight, overscan]);

  return {
    scrollTop,
    setScrollTop,
    totalHeight,
    visibleRange,
  };
}