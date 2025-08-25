"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import MarketplaceContent from './MarketplaceContent';
import { MarketplaceErrorWrapper } from '@/components/error-boundaries/MarketplaceErrorBoundary';

interface MarketplaceLayoutProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Client component for marketplace layout with interactive content.
 * Includes error boundary for resilient error handling.
 */
export default function MarketplaceLayout({ className, children }: MarketplaceLayoutProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Error boundary wraps interactive content */}
      <MarketplaceErrorWrapper context="marketplace-content">
        <MarketplaceContent />
      </MarketplaceErrorWrapper>
      {children}
    </div>
  );
}