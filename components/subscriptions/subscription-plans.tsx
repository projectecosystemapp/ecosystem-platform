"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, Users, Calendar, Star } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  basePriceCents: number;
  billingCycle: string;
  servicesPerCycle: number;
  serviceDurationMinutes: number;
  features: string[];
  benefits: {
    priority_booking?: boolean;
    discount_percent?: number;
  };
  trialDays: number;
  maxSubscribers: number | null;
  currentSubscribers: number;
  hasAvailability: boolean;
  priceDisplay: number;
}

interface SubscriptionPlansProps {
  providerId?: string;
  onSubscribe?: (planId: string) => void;
}

export function SubscriptionPlans({ providerId, onSubscribe }: SubscriptionPlansProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchPlans();
  }, [providerId]);

  const fetchPlans = async () => {
    try {
      const params = new URLSearchParams();
      if (providerId) params.append('providerId', providerId);
      
      const response = await fetch(`/api/subscriptions/plans?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPlans(data.plans);
      } else {
        toast({
          title: "Error",
          description: "Failed to load subscription plans",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: "Error",
        description: "Failed to load subscription plans",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!isSignedIn) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe to a plan",
        variant: "destructive"
      });
      router.push('/sign-in');
      return;
    }

    setSubscribing(planId);
    
    try {
      const response = await fetch('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: data.message || "Successfully subscribed to plan"
        });
        
        // Handle Stripe payment if needed
        if (data.clientSecret) {
          // Redirect to payment confirmation page
          router.push(`/subscriptions/confirm?client_secret=${data.clientSecret}&subscription_id=${data.subscription.id}`);
        } else {
          // No payment needed (e.g., trial period)
          router.push('/dashboard/subscriptions');
        }
        
        if (onSubscribe) {
          onSubscribe(planId);
        }
      } else {
        toast({
          title: "Subscription Failed",
          description: data.error || "Failed to create subscription",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: "Error",
        description: "An error occurred while subscribing",
        variant: "destructive"
      });
    } finally {
      setSubscribing(null);
    }
  };

  const formatBillingCycle = (cycle: string) => {
    const cycles: Record<string, string> = {
      weekly: 'week',
      biweekly: '2 weeks',
      monthly: 'month',
      quarterly: 'quarter',
      annual: 'year'
    };
    return cycles[cycle] || cycle;
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-8 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">No subscription plans available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.id} className={!plan.hasAvailability ? 'opacity-75' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              {plan.trialDays > 0 && (
                <Badge variant="secondary">
                  {plan.trialDays} day trial
                </Badge>
              )}
            </div>
            {plan.description && (
              <CardDescription>{plan.description}</CardDescription>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">
                ${plan.priceDisplay}
              </span>
              <span className="text-muted-foreground">
                / {formatBillingCycle(plan.billingCycle)}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{plan.servicesPerCycle} services per {formatBillingCycle(plan.billingCycle)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{plan.serviceDurationMinutes} min per service</span>
              </div>

              {plan.maxSubscribers && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {plan.currentSubscribers}/{plan.maxSubscribers} subscribers
                  </span>
                </div>
              )}

              {plan.benefits?.priority_booking && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>Priority booking</span>
                </div>
              )}

              {plan.benefits?.discount_percent && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {plan.benefits.discount_percent}% discount
                  </Badge>
                </div>
              )}
            </div>

            {Array.isArray(plan.features) && plan.features.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              className="w-full"
              onClick={() => handleSubscribe(plan.id)}
              disabled={!plan.hasAvailability || subscribing === plan.id}
            >
              {subscribing === plan.id ? (
                "Subscribing..."
              ) : !plan.hasAvailability ? (
                "Sold Out"
              ) : plan.trialDays > 0 ? (
                `Start ${plan.trialDays}-Day Trial`
              ) : (
                "Subscribe Now"
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}