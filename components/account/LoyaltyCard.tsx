"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  TrendingUp, 
  Gift,
  Sparkles,
  ArrowRight,
  Plus,
  Minus
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface LoyaltyCardProps {
  account: {
    pointsBalance: number;
    tier: string;
    lifetimePointsEarned: number;
    tierProgressAmount?: number | null;
    nextTierThreshold?: number | null;
  };
  recentTransactions?: Array<{
    points_transactions: {
      type: string;
      points: number;
      description?: string | null;
      createdAt: Date;
    } | null;
  }>;
}

export function LoyaltyCard({ account, recentTransactions = [] }: LoyaltyCardProps) {
  const getTierInfo = (tier: string) => {
    const tierData = {
      bronze: {
        name: "Bronze",
        color: "bg-orange-100 text-orange-800",
        icon: "🥉",
        benefits: ["Earn 1 point per $1", "Birthday bonus"],
      },
      silver: {
        name: "Silver", 
        color: "bg-gray-100 text-gray-800",
        icon: "🥈",
        benefits: ["Earn 1.25 points per $1", "10% birthday discount", "Priority support"],
      },
      gold: {
        name: "Gold",
        color: "bg-yellow-100 text-yellow-800", 
        icon: "🥇",
        benefits: ["Earn 1.5 points per $1", "15% birthday discount", "Free delivery", "Exclusive offers"],
      },
      platinum: {
        name: "Platinum",
        color: "bg-purple-100 text-purple-800",
        icon: "💎",
        benefits: ["Earn 2 points per $1", "20% birthday discount", "VIP support", "Early access"],
      },
      diamond: {
        name: "Diamond",
        color: "bg-blue-100 text-blue-800",
        icon: "💠",
        benefits: ["Earn 2.5 points per $1", "25% birthday discount", "Concierge service", "Exclusive events"],
      },
    };

    return tierData[tier as keyof typeof tierData] || tierData.bronze;
  };

  const tierInfo = getTierInfo(account.tier);
  const progress = account.tierProgressAmount && account.nextTierThreshold 
    ? (account.tierProgressAmount / account.nextTierThreshold) * 100
    : 0;

  const formatTransactionType = (type: string) => {
    const typeMap: Record<string, string> = {
      earned_booking: "Booking Completed",
      earned_referral: "Referral Bonus",
      earned_bonus: "Bonus Points",
      earned_review: "Review Submitted",
      redeemed_discount: "Discount Applied",
      redeemed_service: "Service Redeemed",
    };
    return typeMap[type] || type.replace(/_/g, " ");
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-600" />
            <CardTitle>Loyalty Program</CardTitle>
          </div>
          <Link href="/account/loyalty">
            <Button variant="ghost" size="sm">
              View Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <CardDescription>Earn points with every booking</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Points Balance */}
        <div className="bg-white rounded-lg p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-3xl font-bold text-purple-900">
                {account.pointsBalance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">points available</p>
            </div>
            <div className="text-4xl">{tierInfo.icon}</div>
          </div>
          
          {/* Tier Badge */}
          <Badge 
            variant="secondary" 
            className={cn("mb-3", tierInfo.color)}
          >
            {tierInfo.name} Tier
          </Badge>

          {/* Progress to Next Tier */}
          {account.nextTierThreshold && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Progress to next tier</span>
                <span>
                  ${account.tierProgressAmount || 0} / ${account.nextTierThreshold}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Recent Activity</p>
            <div className="space-y-2">
              {recentTransactions.slice(0, 3).map((transaction, index) => {
                if (!transaction.points_transactions) return null;
                const tx = transaction.points_transactions;
                const isPositive = tx.points > 0;
                
                return (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {isPositive ? (
                        <Plus className="h-3 w-3 text-green-600" />
                      ) : (
                        <Minus className="h-3 w-3 text-red-600" />
                      )}
                      <span className="text-gray-600">
                        {formatTransactionType(tx.type)}
                      </span>
                    </div>
                    <span className={cn(
                      "font-medium",
                      isPositive ? "text-green-600" : "text-red-600"
                    )}>
                      {isPositive ? "+" : ""}{tx.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/account/loyalty">
            <Button variant="outline" size="sm" className="w-full">
              <Gift className="mr-2 h-4 w-4" />
              Redeem
            </Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="outline" size="sm" className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Earn More
            </Button>
          </Link>
        </div>

        {/* Lifetime Stats */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Lifetime Points Earned</span>
            <span className="font-medium">{account.lifetimePointsEarned.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}