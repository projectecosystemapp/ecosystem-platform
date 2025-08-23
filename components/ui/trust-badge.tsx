"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { 
  Shield, 
  CheckCircle2, 
  Award, 
  Star, 
  TrendingUp, 
  Users,
  Clock,
  DollarSign,
  Zap,
  Heart
} from "lucide-react";

type BadgeVariant = "verified" | "featured" | "new" | "trending" | "popular" | "premium";
type BadgeSize = "xs" | "sm" | "md" | "lg";

const variantStyles: Record<BadgeVariant, string> = {
  verified: "bg-success-500 text-white",
  featured: "bg-gradient-to-r from-primary-500 to-secondary-500 text-white",
  new: "bg-warning-400 text-neutral-900",
  trending: "bg-error-500 text-white",
  popular: "bg-primary-500 text-white",
  premium: "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white",
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: "px-2 py-0.5 text-xs gap-1",
  sm: "px-2.5 py-1 text-xs gap-1.5",
  md: "px-3 py-1.5 text-sm gap-1.5",
  lg: "px-4 py-2 text-base gap-2",
};

const iconSizes: Record<BadgeSize, string> = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

interface TrustBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  pulse?: boolean;
}

const TrustBadge = React.forwardRef<HTMLSpanElement, TrustBadgeProps>(
  ({ className, variant = "verified", size = "sm", icon, pulse, children, ...props }, ref) => {
    const defaultIcons: Record<BadgeVariant, React.ReactNode> = {
      verified: <CheckCircle2 className={iconSizes[size]} />,
      featured: <Star className={iconSizes[size]} />,
      new: <Zap className={iconSizes[size]} />,
      trending: <TrendingUp className={iconSizes[size]} />,
      popular: <Heart className={iconSizes[size]} />,
      premium: <Award className={iconSizes[size]} />,
    };

    const displayIcon = icon || defaultIcons[variant];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-semibold rounded-full shadow-sm",
          "transition-all duration-200",
          variantStyles[variant],
          sizeStyles[size],
          pulse && "animate-pulse-scale",
          className
        )}
        {...props}
      >
        {displayIcon}
        {children}
      </span>
    );
  }
);

TrustBadge.displayName = "TrustBadge";

// Trust Indicator Component
interface TrustIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  metrics?: {
    verified?: boolean;
    rating?: number;
    reviews?: number;
    responseTime?: string;
    completionRate?: number;
  };
}

const TrustIndicator = React.forwardRef<HTMLDivElement, TrustIndicatorProps>(
  ({ className, metrics = {}, ...props }, ref) => {
    const { verified, rating, reviews, responseTime, completionRate } = metrics;

    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center gap-3 text-sm", className)}
        {...props}
      >
        {verified && (
          <div className="flex items-center gap-1.5 text-success-600">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Verified</span>
          </div>
        )}
        
        {rating && (
          <div className="flex items-center gap-1.5">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-4 h-4",
                    i < Math.floor(rating) ? "fill-current" : "fill-none"
                  )}
                />
              ))}
            </div>
            <span className="font-medium text-neutral-700">{rating.toFixed(1)}</span>
            {reviews && (
              <span className="text-neutral-500">({reviews})</span>
            )}
          </div>
        )}
        
        {responseTime && (
          <div className="flex items-center gap-1.5 text-neutral-600">
            <Clock className="w-4 h-4" />
            <span>{responseTime} response</span>
          </div>
        )}
        
        {completionRate && (
          <div className="flex items-center gap-1.5 text-neutral-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>{completionRate}% completion</span>
          </div>
        )}
      </div>
    );
  }
);

TrustIndicator.displayName = "TrustIndicator";

// Social Proof Component
interface SocialProofProps extends React.HTMLAttributes<HTMLDivElement> {
  stats?: {
    providers?: number;
    customers?: number;
    bookings?: number;
    rating?: number;
  };
}

const SocialProof = React.forwardRef<HTMLDivElement, SocialProofProps>(
  ({ className, stats = {}, ...props }, ref) => {
    const formatNumber = (num: number) => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
      return num.toString();
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap items-center justify-center gap-6 py-4 px-6",
          "bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl",
          className
        )}
        {...props}
      >
        {stats.providers && (
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {formatNumber(stats.providers)}+
              </p>
              <p className="text-xs text-neutral-600">Active Providers</p>
            </div>
          </div>
        )}
        
        {stats.customers && (
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-error-500" />
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {formatNumber(stats.customers)}+
              </p>
              <p className="text-xs text-neutral-600">Happy Customers</p>
            </div>
          </div>
        )}
        
        {stats.bookings && (
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning-500" />
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {formatNumber(stats.bookings)}+
              </p>
              <p className="text-xs text-neutral-600">Services Booked</p>
            </div>
          </div>
        )}
        
        {stats.rating && (
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {stats.rating.toFixed(1)}
              </p>
              <p className="text-xs text-neutral-600">Average Rating</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

SocialProof.displayName = "SocialProof";

// Security Badge Component
interface SecurityBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  features?: string[];
}

const SecurityBadge = React.forwardRef<HTMLDivElement, SecurityBadgeProps>(
  ({ className, features = ["Secure Payments", "Verified Providers", "Money-Back Guarantee"], ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-4 px-4 py-2",
          "bg-success-50 border border-success-200 rounded-lg",
          className
        )}
        {...props}
      >
        <Shield className="w-5 h-5 text-success-600 flex-shrink-0" />
        <div className="flex items-center gap-3 text-sm text-success-700 font-medium">
          {features.map((feature, index) => (
            <React.Fragment key={feature}>
              {index > 0 && <span className="text-success-400">•</span>}
              <span>{feature}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
);

SecurityBadge.displayName = "SecurityBadge";

export { TrustBadge, TrustIndicator, SocialProof, SecurityBadge };