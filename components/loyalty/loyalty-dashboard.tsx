"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Trophy, 
  Gift, 
  TrendingUp, 
  History, 
  Star,
  ArrowUp,
  ArrowDown,
  Calendar,
  ChevronRight,
  Loader2,
  Sparkles,
  Users,
  ShoppingBag
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface LoyaltyDashboardProps {
  userId: string;
}

interface AccountData {
  account: {
    id: string;
    pointsBalance: number;
    lifetimePointsEarned: number;
    lifetimePointsRedeemed: number;
    tier: string;
    tierProgressAmount: number;
    nextTierThreshold: number | null;
    benefitsUnlocked: any[];
    specialOffers: any[];
    lastActivityAt: string | null;
  };
  tierInfo: {
    currentTier: any;
    nextTier: any;
    progressPercentage: number;
  };
  recentTransactions: Array<{
    id: string;
    type: string;
    points: number;
    description: string;
    createdAt: string;
    metadata?: any;
  }>;
  statistics: {
    pointsExpiringSoon: number;
    averageEarnRate: number;
    totalBookings: number;
    referralCount: number;
  };
}

interface TierData {
  tiers: Array<{
    tier: string;
    displayName: string;
    description: string;
    requirements: {
      minPoints: number;
      minSpend: number;
    };
    benefits: {
      pointsMultiplier: string;
      discountPercent: number;
      benefitsList: string[];
    };
    visual: {
      color: string;
    };
  }>;
}

interface RedemptionOption {
  id: string;
  name: string;
  description: string;
  type: string;
  pointsCost: number;
  canAfford: boolean;
  discountPercent?: number;
  discountAmountCents?: number;
  stockRemaining?: number;
}

const tierColors: Record<string, string> = {
  bronze: "bg-orange-500",
  silver: "bg-gray-400",
  gold: "bg-yellow-500",
  platinum: "bg-purple-500",
  diamond: "bg-cyan-500",
};

export default function LoyaltyDashboard({ userId }: LoyaltyDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [tierData, setTierData] = useState<TierData | null>(null);
  const [redemptionOptions, setRedemptionOptions] = useState<RedemptionOption[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch account data with transactions
      const [accountRes, tiersRes, redeemRes] = await Promise.all([
        fetch("/api/loyalty/account?includeTransactions=true&transactionLimit=20"),
        fetch("/api/loyalty/tiers"),
        fetch("/api/loyalty/redeem"),
      ]);

      if (accountRes.ok) {
        const accountResult = await accountRes.json();
        if (accountResult.success) {
          setAccountData(accountResult.data);
        }
      }

      if (tiersRes.ok) {
        const tiersResult = await tiersRes.json();
        if (tiersResult.success) {
          setTierData(tiersResult.data);
        }
      }

      if (redeemRes.ok) {
        const redeemResult = await redeemRes.json();
        if (redeemResult.success) {
          setRedemptionOptions(redeemResult.data.options || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch loyalty data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!accountData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to Our Loyalty Program!</h2>
            <p className="text-muted-foreground mb-4">
              Start earning points with your first booking
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Earn 10 points for every dollar spent and unlock exclusive rewards
            </p>
            <Link href="/providers">
              <Button>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Browse Services
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { account, tierInfo, recentTransactions, statistics } = accountData;
  const tierColor = tierColors[account.tier] || "bg-gray-500";

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{account.pointsBalance.toLocaleString()}</div>
            {statistics.pointsExpiringSoon > 0 && (
              <p className="text-xs text-muted-foreground">
                {statistics.pointsExpiringSoon} expiring soon
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge className={tierColor}>
                {tierInfo.currentTier?.name || account.tier.toUpperCase()}
              </Badge>
              {tierInfo.currentTier?.discountPercent > 0 && (
                <span className="text-sm text-green-600">
                  {tierInfo.currentTier.discountPercent}% off
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {account.lifetimePointsEarned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {statistics.averageEarnRate}/month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div>
                <p className="text-lg font-semibold">{statistics.totalBookings}</p>
                <p className="text-xs text-muted-foreground">Bookings</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <p className="text-lg font-semibold">{statistics.referralCount}</p>
                <p className="text-xs text-muted-foreground">Referrals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Progress */}
      {tierInfo.nextTier && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress to {tierInfo.nextTier.name}</CardTitle>
            <CardDescription>
              Earn {tierInfo.nextTier.pointsNeeded.toLocaleString()} more points to unlock
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={tierInfo.progressPercentage} className="h-3 mb-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{account.tier.toUpperCase()}</span>
              <span>{tierInfo.progressPercentage}%</span>
              <span>{tierInfo.nextTier.name.toUpperCase()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="redeem">Redeem</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Current Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="mr-2 h-5 w-5" />
                Your Current Benefits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {tierInfo.currentTier?.benefits?.benefitsList?.map((benefit: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <Star className="mr-2 h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
              {tierInfo.currentTier?.pointsMultiplier && parseFloat(tierInfo.currentTier.pointsMultiplier) > 1 && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    You earn {tierInfo.currentTier.pointsMultiplier}x points on all purchases!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Special Offers */}
          {account.specialOffers && account.specialOffers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Gift className="mr-2 h-5 w-5" />
                  Special Offers for You
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {account.specialOffers.map((offer: any, index: number) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <p className="font-medium">{offer.title}</p>
                      <p className="text-sm text-muted-foreground">{offer.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Refer Friends</CardTitle>
                <CardDescription>
                  Earn 500 points for each friend who joins
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/loyalty/referrals">
                  <Button className="w-full">
                    <Users className="mr-2 h-4 w-4" />
                    Invite Friends
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Book Services</CardTitle>
                <CardDescription>
                  Earn 10 points for every dollar spent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/providers">
                  <Button className="w-full" variant="outline">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Browse Services
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="redeem" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Rewards</CardTitle>
              <CardDescription>
                You have {account.pointsBalance.toLocaleString()} points to spend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {redemptionOptions.map((option) => (
                  <Card key={option.id} className={!option.canAfford ? "opacity-60" : ""}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{option.name}</CardTitle>
                        <Badge variant={option.canAfford ? "default" : "secondary"}>
                          {option.pointsCost.toLocaleString()} pts
                        </Badge>
                      </div>
                      <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {option.discountPercent && (
                        <p className="text-sm font-medium text-green-600 mb-2">
                          {option.discountPercent}% discount
                        </p>
                      )}
                      {option.stockRemaining !== undefined && option.stockRemaining !== null && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {option.stockRemaining} remaining
                        </p>
                      )}
                      <Link href={`/dashboard/loyalty/redeem/${option.id}`}>
                        <Button 
                          size="sm" 
                          className="w-full"
                          disabled={!option.canAfford}
                        >
                          {option.canAfford ? "Redeem Now" : "Not Enough Points"}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Your recent points activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center space-x-3">
                        {transaction.points > 0 ? (
                          <ArrowUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{transaction.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${transaction.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Tiers</CardTitle>
              <CardDescription>
                Unlock more benefits as you progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tierData?.tiers.map((tier) => {
                  const isCurrentTier = tier.tier === account.tier;
                  return (
                    <div 
                      key={tier.tier} 
                      className={`p-4 rounded-lg border ${isCurrentTier ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge className={tierColors[tier.tier]}>
                            {tier.displayName}
                          </Badge>
                          {isCurrentTier && (
                            <Badge variant="outline">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tier.requirements.minPoints.toLocaleString()} points
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {tier.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tier.benefits.benefitsList.slice(0, 3).map((benefit, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                        {tier.benefits.discountPercent > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {tier.benefits.discountPercent}% discount
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}