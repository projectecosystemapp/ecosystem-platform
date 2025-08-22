"use client";

import { Card } from "@/components/ui/card";
import { Info, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FeeBreakdownProps {
  servicePrice: number;
  isAuthenticated: boolean;
  className?: string;
}

export function FeeBreakdown({ servicePrice, isAuthenticated, className }: FeeBreakdownProps) {
  const basePlatformFeeRate = 10; // Base 10% platform fee
  const guestSurchargeRate = 10; // Additional 10% surcharge for guests
  
  const basePlatformFee = Math.round(servicePrice * (basePlatformFeeRate / 100));
  const guestSurcharge = isAuthenticated ? 0 : Math.round(servicePrice * (guestSurchargeRate / 100));
  const totalAmount = servicePrice + guestSurcharge;
  const platformFee = basePlatformFee + guestSurcharge;
  const providerPayout = servicePrice - basePlatformFee; // Provider always gets same amount

  // Format currency
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Price Breakdown
        </h4>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Service Price</span>
            <span className="font-medium">{formatCurrency(servicePrice)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Platform Fee (10%)</span>
            <span className="text-gray-500">{formatCurrency(basePlatformFee)}</span>
          </div>
          
          {!isAuthenticated && (
            <div className="flex justify-between text-sm">
              <span className="text-amber-600">Guest Checkout Surcharge (+10%)</span>
              <span className="font-medium text-amber-600">
                +{formatCurrency(guestSurcharge)}
              </span>
            </div>
          )}
          
          <div className="pt-2 border-t">
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Total Amount</span>
              <span className="font-bold text-lg text-blue-600">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {!isAuthenticated && (
          <Alert className="border-amber-200 bg-amber-50">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              <strong>Save 10% on your total!</strong> Sign in to avoid the guest checkout surcharge.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-500 mt-2">
          <p>Provider receives: {formatCurrency(providerPayout)}</p>
        </div>
      </div>
    </Card>
  );
}