"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Gift, 
  TrendingUp, 
  Clock,
  Star,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Target,
  Zap,
  Shield,
  Crown,
  Gem,
  Plus,
  Minus,
  ArrowUpRight,
  Calendar,
  DollarSign
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface LoyaltyPointsClientProps {
  account: any;
  transactions: any[];
  tiers: any[];
  currentTier: any;
  nextTier: any;
  progressPercentage: number;
  redemptionOptions: any[];
  activeCampaigns: any[];
  expiringPoints: number;
}

export function LoyaltyPointsClient({
  account,
  transactions,
  tiers,
  currentTier,
  nextTier,
  progressPercentage,
  redemptionOptions,
  activeCampaigns,
  expiringPoints,
}: LoyaltyPointsClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const getTierIcon = (tier: string) => {
    const icons: Record<string, React.ElementType> = {
      bronze: Shield,
      silver: Star,
      gold: Crown,
      platinum: Gem,
      diamond: Gem,
    };
    return icons[tier] || Shield;
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-100 text-orange-800 border-orange-200",
      silver: "bg-gray-100 text-gray-800 border-gray-200",
      gold: "bg-yellow-100 text-yellow-800 border-yellow-200",
      platinum: "bg-purple-100 text-purple-800 border-purple-200",
      diamond: "bg-blue-100 text-blue-800 border-blue-200",
    };
    return colors[tier] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatTransactionType = (type: string) => {
    const typeMap: Record<string, { label: string; icon: React.ElementType; color: string }> = {
      earned_booking: { label: "Booking Completed", icon: Plus, color: "text-green-600" },
      earned_referral: { label: "Referral Bonus", icon: Plus, color: "text-blue-600" },
      earned_bonus: { label: "Bonus Points", icon: Plus, color: "text-purple-600" },
      earned_review: { label: "Review Submitted", icon: Plus, color: "text-yellow-600" },
      redeemed_discount: { label: "Discount Applied", icon: Minus, color: "text-red-600" },
      redeemed_service: { label: "Service Redeemed", icon: Minus, color: "text-red-600" },
      expired: { label: "Points Expired", icon: Clock, color: "text-gray-600" },
    };
    return typeMap[type] || { label: type.replace(/_/g, " "), icon: Plus, color: "text-gray-600" };
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const TierIcon = getTierIcon(account.tier);

  return (
    <div className="space-y-6">
      {/* Points Balance Hero */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-blue-50">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Balance Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-semibold">Your Points Balance</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-4xl font-bold text-purple-900">
                    {account.pointsBalance.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Available Points</p>
                </div>
                
                {expiringPoints > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm">
                      <span className="font-medium">{expiringPoints} points</span> expiring soon
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-xs text-gray-500">Lifetime Earned</p>
                    <p className="font-semibold">{account.lifetimePointsEarned.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lifetime Redeemed</p>
                    <p className="font-semibold">{account.lifetimePointsRedeemed.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tier Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TierIcon className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-semibold">Tier Status</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className={cn("px-3 py-1 text-sm capitalize", getTierColor(account.tier))}>
                    {account.tier} Member
                  </Badge>
                  {currentTier && (
                    <span className="text-sm text-gray-600">
                      {currentTier.pointsMultiplier}x points
                    </span>
                  )}
                </div>
                
                {nextTier && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress to {nextTier.tier}</span>
                      <span className="font-medium">
                        {formatPrice(account.tierProgressAmount || 0)} / {formatPrice(nextTier.minSpend)}
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    <p className="text-xs text-gray-500">
                      Spend {formatPrice(nextTier.minSpend - (account.tierProgressAmount || 0))} more to reach {nextTier.tier}
                    </p>
                  </div>
                )}
                
                {currentTier?.benefits && currentTier.benefits.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">Your Benefits:</p>
                    <ul className="space-y-1">
                      {currentTier.benefits.slice(0, 3).map((benefit: string, index: number) => (
                        <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
                          <Sparkles className="h-3 w-3 text-purple-500" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="redeem">Redeem</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">How to Earn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Complete bookings</span>
                  <Badge variant="secondary">1pt per $1</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Write reviews</span>
                  <Badge variant="secondary">50 pts</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Refer friends</span>
                  <Badge variant="secondary">500 pts</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>This Month</span>
                  <span className="font-medium">
                    +{transactions
                      .filter((t) => {
                        const transDate = new Date(t.createdAt);
                        const now = new Date();
                        return transDate.getMonth() === now.getMonth() && 
                               transDate.getFullYear() === now.getFullYear() &&
                               t.points > 0;
                      })
                      .reduce((sum, t) => sum + t.points, 0)} pts
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Pending</span>
                  <span className="font-medium">0 pts</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Available Rewards</span>
                  <span className="font-medium">{redemptionOptions.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Referral Program</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  Earn 500 points for each friend who completes their first booking
                </p>
                <Button className="w-full" size="sm">
                  <Gift className="mr-2 h-4 w-4" />
                  Invite Friends
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest points transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.slice(0, 5).map((transaction) => {
                  const { label, icon: Icon, color } = formatTransactionType(transaction.type);
                  const isPositive = transaction.points > 0;
                  
                  return (
                    <div key={transaction.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", isPositive ? "bg-green-50" : "bg-red-50")}>
                          <Icon className={cn("h-4 w-4", color)} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{label}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-semibold", isPositive ? "text-green-600" : "text-red-600")}>
                          {isPositive ? "+" : ""}{transaction.points}
                        </p>
                        <p className="text-xs text-gray-500">
                          Balance: {transaction.balanceAfter}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All your points transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transactions.map((transaction) => {
                  const { label, icon: Icon, color } = formatTransactionType(transaction.type);
                  const isPositive = transaction.points > 0;
                  
                  return (
                    <div key={transaction.id} className="flex items-center justify-between py-3 border-b">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", isPositive ? "bg-green-50" : "bg-red-50")}>
                          <Icon className={cn("h-4 w-4", color)} />
                        </div>
                        <div>
                          <p className="font-medium">{label}</p>
                          {transaction.description && (
                            <p className="text-sm text-gray-600">{transaction.description}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {format(new Date(transaction.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-semibold text-lg", isPositive ? "text-green-600" : "text-red-600")}>
                          {isPositive ? "+" : ""}{transaction.points}
                        </p>
                        <p className="text-sm text-gray-500">
                          Balance: {transaction.balanceAfter}
                        </p>
                        {transaction.expiresAt && (
                          <p className="text-xs text-yellow-600">
                            Expires {format(new Date(transaction.expiresAt), "MMM dd")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redeem Tab */}
        <TabsContent value="redeem">
          <div className="grid md:grid-cols-2 gap-4">
            {redemptionOptions.map((option) => (
              <Card key={option.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{option.name}</CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </div>
                    <Badge variant="secondary">{option.pointsCost} pts</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {option.discountPercent && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{option.discountPercent}% off your next booking</span>
                      </div>
                    )}
                    {option.discountAmountCents && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{formatPrice(option.discountAmountCents)} discount</span>
                      </div>
                    )}
                    {option.terms && (
                      <p className="text-xs text-gray-500">{option.terms}</p>
                    )}
                    <Button 
                      className="w-full" 
                      disabled={account.pointsBalance < option.pointsCost}
                    >
                      {account.pointsBalance >= option.pointsCost ? "Redeem Now" : "Insufficient Points"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tiers Tab */}
        <TabsContent value="tiers">
          <div className="space-y-4">
            {tiers.map((tier, index) => {
              const Icon = getTierIcon(tier.tier);
              const isCurrentTier = tier.tier === account.tier;
              
              return (
                <Card key={tier.id} className={cn(
                  "relative overflow-hidden",
                  isCurrentTier && "border-2 border-purple-500"
                )}>
                  {isCurrentTier && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-purple-600 text-white">Current Tier</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={cn("p-3 rounded-lg", getTierColor(tier.tier))}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="capitalize">{tier.displayName}</CardTitle>
                        <CardDescription>{tier.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Requirements</p>
                        <ul className="space-y-1 text-sm text-gray-600">
                          <li>• Annual spend: {formatPrice(tier.minSpend)}</li>
                          {tier.minBookings > 0 && <li>• Minimum bookings: {tier.minBookings}</li>}
                          {tier.minPoints > 0 && <li>• Points earned: {tier.minPoints}</li>}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Benefits</p>
                        <ul className="space-y-1 text-sm text-gray-600">
                          <li>• {tier.pointsMultiplier}x points on all bookings</li>
                          {tier.discountPercent > 0 && <li>• {tier.discountPercent}% automatic discount</li>}
                          {tier.freeDelivery && <li>• Free delivery on all orders</li>}
                          {tier.prioritySupport && <li>• Priority customer support</li>}
                          {tier.exclusiveAccess && <li>• Exclusive early access</li>}
                          {tier.birthdayBonusPoints > 0 && <li>• {tier.birthdayBonusPoints} birthday bonus points</li>}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <div className="space-y-4">
            {activeCampaigns.length > 0 ? (
              activeCampaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{campaign.name}</CardTitle>
                        <CardDescription>{campaign.description}</CardDescription>
                      </div>
                      <Badge variant="secondary">
                        <Calendar className="mr-1 h-3 w-3" />
                        Ends {format(new Date(campaign.endDate), "MMM dd")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {campaign.pointsMultiplier > 1 && (
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm">{campaign.pointsMultiplier}x points during campaign</span>
                        </div>
                      )}
                      {campaign.bonusPoints > 0 && (
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-purple-500" />
                          <span className="text-sm">{campaign.bonusPoints} bonus points</span>
                        </div>
                      )}
                      <Button variant="outline" className="w-full" size="sm">
                        Learn More
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No active campaigns at the moment</p>
                  <p className="text-sm text-gray-400 mt-2">Check back soon for special offers!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}