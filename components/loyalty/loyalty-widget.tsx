"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, TrendingUp, Trophy, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LoyaltyAccount {
  pointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  tier: string;
  tierProgressAmount: number;
  nextTierThreshold: number | null;
  benefitsUnlocked: any[];
  lastActivityAt: string | null;
}

interface TierInfo {
  currentTier: {
    name: string;
    description?: string;
    benefits?: any[];
    pointsMultiplier?: string;
    discountPercent?: number;
    color?: string;
  } | null;
  nextTier: {
    name: string;
    pointsNeeded: number;
    spendNeeded: number;
  } | null;
  progressPercentage: number;
}

interface LoyaltyWidgetProps {
  className?: string;
  compact?: boolean;
}

const tierColors = {
  bronze: "bg-orange-500",
  silver: "bg-gray-400",
  gold: "bg-yellow-500",
  platinum: "bg-purple-500",
  diamond: "bg-cyan-500",
};

const tierIcons = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
  diamond: "💎",
};

export default function LoyaltyWidget({ className, compact = false }: LoyaltyWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/loyalty/account?includeTransactions=false");
      
      if (!response.ok) {
        throw new Error("Failed to fetch loyalty data");
      }

      const result = await response.json();
      if (result.success && result.data) {
        setAccount(result.data.account);
        setTierInfo(result.data.tierInfo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !account) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Sparkles className="mx-auto h-8 w-8 mb-2" />
            <p>Join our loyalty program to start earning points!</p>
            <p className="text-sm mt-2">Earn 10 points for every dollar spent</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tierColor = tierColors[account.tier as keyof typeof tierColors] || "bg-gray-500";
  const tierIcon = tierIcons[account.tier as keyof typeof tierIcons] || "⭐";

  if (compact) {
    // Compact view for dashboard
    return (
      <Card className={cn("hover:shadow-lg transition-shadow", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white", tierColor)}>
                <span className="text-lg">{tierIcon}</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Loyalty Points</p>
                <p className="text-2xl font-bold">{account.pointsBalance.toLocaleString()}</p>
              </div>
            </div>
            <Link href="/dashboard/loyalty">
              <Button variant="ghost" size="sm">
                View Details
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full view
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5" />
            Loyalty Program
          </span>
          <Badge className={cn("", tierColor)}>
            {tierInfo?.currentTier?.name || account.tier.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Points Balance */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="text-center">
            <p className="text-3xl font-bold">{account.pointsBalance.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Available Points</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-green-600">
              {account.lifetimePointsEarned.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Lifetime Earned</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-blue-600">
              {account.lifetimePointsRedeemed.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Points Redeemed</p>
          </div>
        </div>

        {/* Tier Progress */}
        {tierInfo?.nextTier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress to {tierInfo.nextTier.name}</span>
              <span className="text-muted-foreground">
                {tierInfo.nextTier.pointsNeeded.toLocaleString()} points needed
              </span>
            </div>
            <Progress value={tierInfo.progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {tierInfo.progressPercentage}% complete
            </p>
          </div>
        )}

        {/* Current Benefits */}
        {tierInfo?.currentTier?.benefits && tierInfo.currentTier.benefits.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center">
              <Trophy className="mr-1 h-4 w-4" />
              Your Benefits
            </p>
            <ul className="text-sm space-y-1">
              {tierInfo.currentTier.benefits.slice(0, 3).map((benefit: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2 text-green-500">✓</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            {tierInfo.currentTier.discountPercent && tierInfo.currentTier.discountPercent > 0 && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                <p className="text-sm text-green-700 dark:text-green-400">
                  You get {tierInfo.currentTier.discountPercent}% off all bookings!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Link href="/dashboard/loyalty/redeem" className="flex-1">
            <Button variant="default" className="w-full">
              <Gift className="mr-2 h-4 w-4" />
              Redeem Points
            </Button>
          </Link>
          <Link href="/dashboard/loyalty" className="flex-1">
            <Button variant="outline" className="w-full">
              <TrendingUp className="mr-2 h-4 w-4" />
              View History
            </Button>
          </Link>
        </div>

        {/* Last Activity */}
        {account.lastActivityAt && (
          <p className="text-xs text-muted-foreground text-center">
            Last activity: {new Date(account.lastActivityAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}