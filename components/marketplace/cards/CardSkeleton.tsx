"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
  view?: "grid" | "list";
  type?: "service" | "event" | "space" | "thing";
  className?: string;
  count?: number;
}

export function CardSkeleton({ 
  view = "grid", 
  type = "service",
  className,
  count = 1 
}: CardSkeletonProps) {
  const isListView = view === "list";

  const SkeletonCard = () => {
    if (isListView) {
      // List view skeleton
      return (
        <Card className="w-full overflow-hidden">
          <div className="flex">
            {/* Image skeleton */}
            <Skeleton className="w-48 h-36 rounded-l-lg flex-shrink-0" />
            
            {/* Content skeleton */}
            <div className="flex-1 p-4 space-y-3">
              {/* Header with avatar */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              
              {/* Title */}
              <Skeleton className="h-5 w-3/4" />
              
              {/* Description */}
              <div className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              
              {/* Tags */}
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    // Grid view skeleton
    return (
      <Card className={cn("overflow-hidden", className)}>
        {/* Image skeleton */}
        <Skeleton className="h-48 w-full" />
        
        {/* Content skeleton */}
        <CardContent className="p-4 space-y-3">
          {/* Provider/Host info */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          
          {/* Title */}
          <Skeleton className="h-4 w-full" />
          
          {/* Description */}
          <div className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          
          {/* Type-specific content */}
          {type === "service" && (
            <>
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </>
          )}
          
          {type === "event" && (
            <>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </>
          )}
          
          {type === "space" && (
            <>
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-18 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </>
          )}
          
          {type === "thing" && (
            <>
              <Skeleton className="h-5 w-24" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </>
          )}
          
          {/* Price and action button */}
          <div className="flex items-center justify-between pt-3 border-t">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  };

  if (count === 1) {
    return <SkeletonCard />;
  }

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </>
  );
}

// Animated skeleton for smoother loading experience
export function AnimatedCardSkeleton({ 
  view = "grid", 
  type = "service",
  className,
  count = 1 
}: CardSkeletonProps) {
  return (
    <div 
      className={cn(
        "animate-pulse",
        view === "grid" ? "grid gap-4" : "space-y-4",
        className
      )}
    >
      <CardSkeleton view={view} type={type} count={count} />
    </div>
  );
}

// Grid of skeleton cards for loading states
export function CardSkeletonGrid({ 
  columns = 3,
  rows = 2,
  type = "service",
  className 
}: {
  columns?: number;
  rows?: number;
  type?: "service" | "event" | "space" | "thing";
  className?: string;
}) {
  const totalCards = columns * rows;
  
  return (
    <div 
      className={cn(
        "grid gap-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 md:grid-cols-2",
        columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: totalCards }).map((_, index) => (
        <AnimatedCardSkeleton 
          key={index} 
          view="grid" 
          type={type}
        />
      ))}
    </div>
  );
}

// List of skeleton cards for loading states
export function CardSkeletonList({ 
  count = 5,
  type = "service",
  className 
}: {
  count?: number;
  type?: "service" | "event" | "space" | "thing";
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <AnimatedCardSkeleton 
          key={index} 
          view="list" 
          type={type}
        />
      ))}
    </div>
  );
}

export default CardSkeleton;