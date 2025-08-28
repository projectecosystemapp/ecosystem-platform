"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  Shield, 
  CreditCard,
  FileCheck,
  Award,
  Clock,
  Verified,
  AlertCircle
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type VerificationBadgeType = 
  | "identity" 
  | "payment" 
  | "background" 
  | "insurance" 
  | "premium" 
  | "quick-response"
  | "completion-rate"
  | "pending";

export type VerificationBadgeSize = "xs" | "sm" | "md" | "lg";

const verificationBadgeVariants = cva(
  "inline-flex items-center gap-1 font-medium rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      type: {
        identity: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
        payment: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", 
        background: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
        insurance: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
        premium: "bg-gradient-to-r from-yellow-50 to-amber-50 text-amber-700 border-amber-200 hover:from-yellow-100 hover:to-amber-100",
        "quick-response": "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
        "completion-rate": "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
        pending: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
      },
      size: {
        xs: "px-1.5 py-0.5 text-xs",
        sm: "px-2 py-1 text-xs",
        md: "px-2.5 py-1 text-sm", 
        lg: "px-3 py-1.5 text-sm"
      }
    },
    defaultVariants: {
      type: "identity",
      size: "sm"
    }
  }
);

const iconSizeMap: Record<VerificationBadgeSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3 w-3", 
  md: "h-4 w-4",
  lg: "h-4 w-4"
};

interface VerificationBadgeProps 
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof verificationBadgeVariants> {
  type: VerificationBadgeType;
  size?: VerificationBadgeSize;
  showTooltip?: boolean;
  customLabel?: string;
}

const badgeConfig: Record<VerificationBadgeType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tooltip: string;
}> = {
  identity: {
    icon: CheckCircle2,
    label: "ID Verified",
    tooltip: "Identity has been verified through government-issued documents"
  },
  payment: {
    icon: CreditCard,
    label: "Payment Verified", 
    tooltip: "Payment method verified and ready to accept bookings"
  },
  background: {
    icon: FileCheck,
    label: "Background Checked",
    tooltip: "Professional background and references verified"
  },
  insurance: {
    icon: Shield,
    label: "Insured",
    tooltip: "Professional liability insurance verified and active"
  },
  premium: {
    icon: Award,
    label: "Premium Provider",
    tooltip: "Top-rated provider with exceptional service history"
  },
  "quick-response": {
    icon: Clock,
    label: "Quick Response",
    tooltip: "Typically responds to inquiries within 1 hour"
  },
  "completion-rate": {
    icon: Verified,
    label: "High Completion",
    tooltip: "98%+ successful completion rate for bookings"
  },
  pending: {
    icon: AlertCircle,
    label: "Verification Pending",
    tooltip: "Verification process is currently in progress"
  }
};

const VerificationBadge = React.forwardRef<HTMLSpanElement, VerificationBadgeProps>(
  ({ className, type, size = "sm", showTooltip = true, customLabel, ...props }, ref) => {
    const config = badgeConfig[type];
    const Icon = config.icon;
    const label = customLabel || config.label;
    const iconSize = iconSizeMap[size];

    const badge = (
      <span
        ref={ref}
        className={cn(verificationBadgeVariants({ type, size }), className)}
        {...props}
      >
        <Icon className={iconSize} />
        <span className="whitespace-nowrap">{label}</span>
      </span>
    );

    if (!showTooltip) {
      return badge;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{config.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

VerificationBadge.displayName = "VerificationBadge";

// Compound component for displaying multiple verification badges
interface VerificationBadgeGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  verifications: {
    type: VerificationBadgeType;
    verified: boolean;
    customLabel?: string;
  }[];
  size?: VerificationBadgeSize;
  showTooltips?: boolean;
  maxDisplay?: number;
  orientation?: "horizontal" | "vertical";
}

const VerificationBadgeGroup = React.forwardRef<HTMLDivElement, VerificationBadgeGroupProps>(
  ({ 
    className, 
    verifications, 
    size = "sm", 
    showTooltips = true, 
    maxDisplay,
    orientation = "horizontal",
    ...props 
  }, ref) => {
    // Filter to only show verified badges
    const verifiedBadges = verifications.filter(v => v.verified);
    
    // Limit display if maxDisplay is set
    const displayBadges = maxDisplay ? verifiedBadges.slice(0, maxDisplay) : verifiedBadges;
    const hiddenCount = maxDisplay ? verifiedBadges.length - maxDisplay : 0;

    if (verifiedBadges.length === 0) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-1",
          orientation === "vertical" ? "flex-col" : "flex-row flex-wrap items-center",
          className
        )}
        {...props}
      >
        {displayBadges.map((verification, index) => (
          <VerificationBadge
            key={`${verification.type}-${index}`}
            type={verification.type}
            size={size}
            showTooltip={showTooltips}
            customLabel={verification.customLabel}
          />
        ))}
        {hiddenCount > 0 && (
          <span className={cn(
            "inline-flex items-center font-medium rounded-full border bg-gray-50 text-gray-600 border-gray-200",
            verificationBadgeVariants({ size })
          )}>
            +{hiddenCount}
          </span>
        )}
      </div>
    );
  }
);

VerificationBadgeGroup.displayName = "VerificationBadgeGroup";

// Helper hook for provider verification badges
interface UseProviderVerificationBadgesParams {
  isVerified?: boolean;
  stripeOnboardingComplete?: boolean; 
  hasInsurance?: boolean;
  averageRating?: number | string;
  completedBookings?: number;
  responseTime?: string;
}

export function useProviderVerificationBadges({
  isVerified,
  stripeOnboardingComplete,
  hasInsurance,
  averageRating,
  completedBookings,
  responseTime
}: UseProviderVerificationBadgesParams) {
  const rating = averageRating ? Number(averageRating) : 0;
  const bookings = completedBookings || 0;

  return [
    {
      type: "identity" as const,
      verified: Boolean(isVerified),
    },
    {
      type: "payment" as const,
      verified: Boolean(stripeOnboardingComplete),
    },
    {
      type: "insurance" as const,
      verified: Boolean(hasInsurance),
    },
    {
      type: "premium" as const,
      verified: rating >= 4.8 && bookings >= 50,
      customLabel: "Top Rated"
    },
    {
      type: "completion-rate" as const,
      verified: bookings >= 20 && rating >= 4.5,
      customLabel: "Reliable"
    },
    {
      type: "quick-response" as const,
      verified: Boolean(responseTime && (responseTime.includes("minutes") || responseTime.includes("hour"))),
    }
  ];
}

export { 
  VerificationBadge, 
  VerificationBadgeGroup, 
  verificationBadgeVariants,
  type VerificationBadgeType,
  type VerificationBadgeSize 
};