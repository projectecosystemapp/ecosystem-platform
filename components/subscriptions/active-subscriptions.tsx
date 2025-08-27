"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Clock, 
  CreditCard, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  Pause,
  Play
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ActiveSubscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  servicesUsedThisPeriod: number;
  plan: {
    name: string;
    description: string;
    priceDisplay: number;
    billingCycle: string;
    servicesPerCycle: number;
  };
  provider: {
    businessName: string;
  };
  usage: {
    servicesRemaining: number;
    percentageUsed: number;
    canUseService: boolean;
  };
}

export function ActiveSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<ActiveSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<ActiveSubscription | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      // This would be a dedicated endpoint for listing user's subscriptions
      // For now, we'll simulate with individual fetches
      const response = await fetch('/api/subscriptions/customer');
      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.subscriptions);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast({
        title: "Error",
        description: "Failed to load subscriptions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (subscription: ActiveSubscription) => {
    setSelectedSubscription(subscription);
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedSubscription) return;
    
    setCancelingId(selectedSubscription.id);
    setShowCancelDialog(false);
    
    try {
      const response = await fetch(`/api/subscriptions/${selectedSubscription.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Subscription Canceled",
          description: data.message
        });
        
        // Refresh subscriptions
        await fetchSubscriptions();
      } else {
        toast({
          title: "Cancellation Failed",
          description: data.error || "Failed to cancel subscription",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: "Error",
        description: "An error occurred while canceling",
        variant: "destructive"
      });
    } finally {
      setCancelingId(null);
      setSelectedSubscription(null);
    }
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="secondary">Canceling</Badge>;
    }
    
    const statusConfig: Record<string, { variant: any; icon: any }> = {
      active: { variant: 'default', icon: CheckCircle },
      trialing: { variant: 'secondary', icon: Clock },
      past_due: { variant: 'destructive', icon: AlertCircle },
      canceled: { variant: 'outline', icon: XCircle },
      paused: { variant: 'secondary', icon: Pause }
    };

    const config = statusConfig[status] || statusConfig.active;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/4" />
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground mb-4">You don't have any active subscriptions</p>
          <Button onClick={() => window.location.href = '/subscriptions'}>
            Browse Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {subscriptions.map((subscription) => (
          <Card key={subscription.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {subscription.plan.name}
                  </CardTitle>
                  <CardDescription>
                    {subscription.provider.businessName}
                  </CardDescription>
                </div>
                {getStatusBadge(subscription.status, subscription.cancelAtPeriodEnd)}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span>
                    ${subscription.plan.priceDisplay}/{subscription.plan.billingCycle}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Renews {format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Services used this period</span>
                  <span className="font-medium">
                    {subscription.servicesUsedThisPeriod} / {subscription.plan.servicesPerCycle}
                  </span>
                </div>
                <Progress value={subscription.usage.percentageUsed} />
                <p className="text-xs text-muted-foreground">
                  {subscription.usage.servicesRemaining} services remaining
                </p>
              </div>

              {subscription.plan.description && (
                <p className="text-sm text-muted-foreground">
                  {subscription.plan.description}
                </p>
              )}
            </CardContent>

            <CardFooter className="gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`/subscriptions/${subscription.id}`}>
                  View Details
                </a>
              </Button>
              
              {subscription.usage.canUseService && (
                <Button size="sm">
                  Book Service
                </Button>
              )}
              
              {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCancelClick(subscription)}
                  disabled={cancelingId === subscription.id}
                >
                  {cancelingId === subscription.id ? "Canceling..." : "Cancel"}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your {selectedSubscription?.plan.name} subscription? 
              You'll continue to have access until {selectedSubscription && format(new Date(selectedSubscription.currentPeriodEnd), 'MMMM dd, yyyy')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm}>
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}