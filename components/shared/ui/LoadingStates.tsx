import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { memo } from "react";

// Skeleton Components - Server-side compatible (no client-side hooks)
export const CardSkeleton = memo(function CardSkeleton({ 
  className = "" 
}: { 
  className?: string 
}) {
  return (
    <Card className={`p-6 ${className}`} aria-busy="true" aria-label="Loading content">
      <div className="space-y-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </Card>
  );
});

export const TableSkeleton = memo(function TableSkeleton({ 
  rows = 5,
  columns = 4,
  className = ""
}: { 
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading table">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-8" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={`row-${rowIndex}`} 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-6" />
          ))}
        </div>
      ))}
    </div>
  );
});

export const ListSkeleton = memo(function ListSkeleton({ 
  items = 3,
  className = ""
}: { 
  items?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
});

export const GridSkeleton = memo(function GridSkeleton({ 
  items = 6,
  columns = 3,
  className = ""
}: { 
  items?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div 
      className={`grid gap-4 ${className}`} 
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      aria-busy="true" 
      aria-label="Loading grid"
    >
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </Card>
      ))}
    </div>
  );
});

export const ProfileSkeleton = memo(function ProfileSkeleton({ 
  className = "" 
}: { 
  className?: string 
}) {
  return (
    <div className={`space-y-4 ${className}`} aria-busy="true" aria-label="Loading profile">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
});

export const FormSkeleton = memo(function FormSkeleton({ 
  fields = 4,
  className = ""
}: { 
  fields?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`} aria-busy="true" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
});

// Loading spinner - Can be used in both server and client components
export const LoadingSpinner = memo(function LoadingSpinner({ 
  size = "default",
  className = ""
}: { 
  size?: "small" | "default" | "large";
  className?: string;
}) {
  const sizeClasses = {
    small: "w-4 h-4",
    default: "w-8 h-8",
    large: "w-12 h-12"
  };

  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div 
        className={`${sizeClasses[size]} border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin`}
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
});

// Page loading state
export const PageLoader = memo(function PageLoader({ 
  message = "Loading...",
  className = ""
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div 
      className={`flex flex-col items-center justify-center min-h-[400px] ${className}`}
      role="status"
      aria-label={message}
    >
      <LoadingSpinner size="large" />
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  );
});

// Inline loading state
export const InlineLoader = memo(function InlineLoader({ 
  text = "Loading...",
  className = ""
}: { 
  text?: string;
  className?: string;
}) {
  return (
    <span 
      className={`inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-label={text}
    >
      <LoadingSpinner size="small" />
      <span className="text-sm text-gray-600">{text}</span>
    </span>
  );
});