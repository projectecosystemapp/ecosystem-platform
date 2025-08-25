"use client";

import React from 'react';
import MarketplaceContent from './MarketplaceContent';
import { MarketplaceErrorWrapper } from '@/components/error-boundaries/MarketplaceErrorBoundary';
import { cn } from '@/lib/utils';

interface UnifiedMarketplaceViewProps {
  className?: string;
}

/**
 * Client-side unified marketplace view component.
 * Includes error boundary for resilient error handling.
 */
export default function UnifiedMarketplaceView({ className }: UnifiedMarketplaceViewProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <MarketplaceErrorWrapper context="marketplace-content">
        <MarketplaceContent />
      </MarketplaceErrorWrapper>
    </div>
  );
}