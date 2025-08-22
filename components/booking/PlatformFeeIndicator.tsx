"use client";

import { useState } from "react";
import { Info, Calculator, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PlatformFeeIndicatorProps {
  servicePrice?: number;
  variant?: "inline" | "card" | "modal";
  showCalculator?: boolean;
  className?: string;
}

export function PlatformFeeIndicator({
  servicePrice = 0,
  variant = "inline",
  showCalculator = false,
  className,
}: PlatformFeeIndicatorProps) {
  const { isSignedIn } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [calculatorPrice, setCalculatorPrice] = useState(servicePrice || 10000); // Default $100

  const baseFeeRate = 0.10; // 10% base fee
  const guestSurchargeRate = 0.10; // 10% guest surcharge

  const calculateFees = (price: number, authenticated: boolean) => {
    const baseFee = Math.round(price * baseFeeRate);
    const surcharge = authenticated ? 0 : Math.round(price * guestSurchargeRate);
    const total = price + surcharge;
    const platformTotal = baseFee + surcharge;
    const providerPayout = price - baseFee;

    return {
      servicePrice: price,
      baseFee,
      surcharge,
      total,
      platformTotal,
      providerPayout,
    };
  };

  const fees = calculateFees(servicePrice || calculatorPrice, isSignedIn || false);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  // Inline variant - simple badge with popover
  if (variant === "inline") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-auto p-1 hover:bg-transparent", className)}
          >
            <Badge variant="outline" className="cursor-pointer">
              <Info className="h-3 w-3 mr-1" />
              {isSignedIn ? "10% platform fee" : "+10% guest fee"}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h4 className="font-medium">Platform Fees Explained</h4>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Base Platform Fee:</span>
                <span>10%</span>
              </div>
              {!isSignedIn && (
                <div className="flex justify-between text-amber-600">
                  <span>Guest Surcharge:</span>
                  <span>+10%</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>Your Total Fee:</span>
                <span>{isSignedIn ? "10%" : "20% total"}</span>
              </div>
            </div>
            {!isSignedIn && (
              <>
                <Separator />
                <div className="bg-amber-50 p-2 rounded text-xs">
                  <Link href="/sign-in" className="text-primary hover:underline">
                    Sign in to save 10% on every booking →
                  </Link>
                </div>
              </>
            )}
            <Separator />
            <p className="text-xs text-muted-foreground">
              Platform fees help us maintain quality, provide support, and ensure secure payments.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Card variant - expandable details
  if (variant === "card") {
    return (
      <Card className={cn("p-4", className)}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium">Pricing & Fees</span>
              {!isSignedIn && (
                <Badge variant="secondary" className="text-xs">
                  Guest Checkout
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-3">
            <Separator />
            {servicePrice > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Service Price:</span>
                  <span>{formatCurrency(fees.servicePrice)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Platform Fee (10%):</span>
                  <span>{formatCurrency(fees.baseFee)}</span>
                </div>
                {!isSignedIn && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Guest Surcharge (+10%):</span>
                    <span>+{formatCurrency(fees.surcharge)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total Amount:</span>
                  <span className="text-primary">
                    {formatCurrency(fees.total)}
                  </span>
                </div>
              </div>
            )}
            
            <div className="bg-muted p-3 rounded-md text-xs space-y-1">
              <p className="font-medium">How fees work:</p>
              <ul className="space-y-1 ml-4">
                <li>• Service providers set their own prices</li>
                <li>• We charge a 10% platform fee for all bookings</li>
                {!isSignedIn && (
                  <li className="text-amber-600">
                    • Guests pay an additional 10% surcharge
                  </li>
                )}
                <li>• Providers receive {formatCurrency(fees.providerPayout)} of {formatCurrency(fees.servicePrice)}</li>
              </ul>
            </div>

            {!isSignedIn && (
              <div className="bg-primary/10 p-3 rounded-md">
                <p className="text-sm font-medium mb-1">Save 10% on every booking!</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Create a free account to avoid guest surcharges.
                </p>
                <Link href="/sign-up">
                  <Button size="sm" className="w-full">
                    Sign Up & Save
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  // Modal variant - full fee calculator
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Calculator className="h-4 w-4 mr-2" />
          Fee Calculator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Platform Fee Calculator</DialogTitle>
          <DialogDescription>
            See exactly how much you'll pay for any service
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Price Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Service Price</label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                value={calculatorPrice / 100}
                onChange={(e) => setCalculatorPrice(Math.round(parseFloat(e.target.value || "0") * 100))}
                className="flex-1 px-3 py-2 border rounded-md"
                min="0"
                step="10"
              />
            </div>
          </div>

          <Separator />

          {/* Fee Breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium">Your Cost Breakdown</h4>
            
            {/* Logged In Calculation */}
            <div className="space-y-2 p-3 border rounded-md">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Signed In</Badge>
                  Total Cost:
                </span>
                <span className="text-primary">
                  {formatCurrency(calculateFees(calculatorPrice, true).total)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Platform fee: {formatCurrency(calculateFees(calculatorPrice, true).baseFee)} (10%)
              </div>
            </div>

            {/* Guest Calculation */}
            <div className="space-y-2 p-3 border border-amber-200 bg-amber-50 rounded-md">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Guest</Badge>
                  Total Cost:
                </span>
                <span className="text-amber-600">
                  {formatCurrency(calculateFees(calculatorPrice, false).total)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Platform fee: {formatCurrency(calculateFees(calculatorPrice, false).baseFee)} (10%) + 
                Guest surcharge: {formatCurrency(calculateFees(calculatorPrice, false).surcharge)} (10%)
              </div>
            </div>

            {/* Savings */}
            <div className="bg-primary/10 p-3 rounded-md">
              <p className="text-sm font-medium text-primary">
                You save {formatCurrency(calculateFees(calculatorPrice, false).surcharge)} by signing in!
              </p>
            </div>
          </div>

          <Separator />

          {/* Provider Payout Info */}
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Provider Information:</p>
            <p>Service providers always receive {formatCurrency(calculateFees(calculatorPrice, true).providerPayout)} ({100 - baseFeeRate * 100}% of service price) regardless of guest status.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}