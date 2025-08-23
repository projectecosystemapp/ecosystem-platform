"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  verified?: boolean;
  featured?: boolean;
  hoverable?: boolean;
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ className, verified, featured, hoverable = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative bg-white rounded-xl border overflow-hidden",
          "transition-all duration-300",
          hoverable && [
            "hover:border-primary-200",
            "hover:shadow-lg",
            "hover:-translate-y-1",
          ],
          featured ? [
            "border-primary-300",
            "shadow-brand/20 shadow-lg",
            "bg-gradient-to-br from-white to-primary-50/30",
          ] : "border-neutral-200",
          className
        )}
        {...props}
      >
        {/* Verified Badge */}
        {verified && (
          <div className="absolute top-3 right-3 z-10">
            <span className="bg-success-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified
            </span>
          </div>
        )}
        
        {/* Featured Badge */}
        {featured && (
          <div className="absolute top-0 left-0 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-1 text-xs font-bold rounded-br-lg shadow-md">
            FEATURED
          </div>
        )}
        
        {children}
      </div>
    );
  }
);

PremiumCard.displayName = "PremiumCard";

interface PremiumCardImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
}

const PremiumCardImage = React.forwardRef<HTMLDivElement, PremiumCardImageProps>(
  ({ className, src, alt, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative h-48 bg-neutral-100 overflow-hidden", className)}
        {...props}
      >
        {src ? (
          <img 
            src={src} 
            alt={alt} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
        )}
        {children}
      </div>
    );
  }
);

PremiumCardImage.displayName = "PremiumCardImage";

interface PremiumCardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const PremiumCardContent = React.forwardRef<HTMLDivElement, PremiumCardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 space-y-3", className)} {...props} />
  )
);

PremiumCardContent.displayName = "PremiumCardContent";

interface PremiumCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const PremiumCardHeader = React.forwardRef<HTMLDivElement, PremiumCardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-start justify-between", className)} {...props} />
  )
);

PremiumCardHeader.displayName = "PremiumCardHeader";

interface PremiumCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const PremiumCardTitle = React.forwardRef<HTMLHeadingElement, PremiumCardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-semibold text-lg text-neutral-900 line-clamp-1", className)}
      {...props}
    />
  )
);

PremiumCardTitle.displayName = "PremiumCardTitle";

interface PremiumCardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const PremiumCardDescription = React.forwardRef<HTMLParagraphElement, PremiumCardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-neutral-600 line-clamp-2", className)} {...props} />
  )
);

PremiumCardDescription.displayName = "PremiumCardDescription";

interface PremiumCardPriceProps extends React.HTMLAttributes<HTMLDivElement> {
  amount: string;
  period?: string;
  currency?: string;
}

const PremiumCardPrice = React.forwardRef<HTMLDivElement, PremiumCardPriceProps>(
  ({ className, amount, period, currency = "$", ...props }, ref) => (
    <div ref={ref} className={cn("text-right", className)} {...props}>
      <p className="text-lg font-bold text-neutral-900">
        {currency}{amount}
      </p>
      {period && <p className="text-xs text-neutral-500">{period}</p>}
    </div>
  )
);

PremiumCardPrice.displayName = "PremiumCardPrice";

export {
  PremiumCard,
  PremiumCardImage,
  PremiumCardContent,
  PremiumCardHeader,
  PremiumCardTitle,
  PremiumCardDescription,
  PremiumCardPrice,
};