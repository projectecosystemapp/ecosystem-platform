"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Calendar,
  Users,
  Clock,
  CreditCard,
  Settings,
  BookOpen,
  PlusCircle,
  TrendingUp,
  MessageSquare,
  Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  providerId: string;
  stripeOnboardingComplete: boolean;
}

export function QuickActions({ providerId, stripeOnboardingComplete }: QuickActionsProps) {
  const router = useRouter();

  const actions = [
    {
      icon: Calendar,
      label: "Manage Availability",
      description: "Set your working hours",
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
      onClick: () => router.push(`/provider/${providerId}/availability`),
      enabled: true,
    },
    {
      icon: Users,
      label: "View Profile",
      description: "See how customers see you",
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100",
      onClick: () => router.push(`/providers/${providerId}`),
      enabled: true,
    },
    {
      icon: Clock,
      label: "Update Services",
      description: "Manage services & pricing",
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
      onClick: () => router.push(`/provider/${providerId}/services`),
      enabled: true,
    },
    {
      icon: CreditCard,
      label: "Payment Settings",
      description: stripeOnboardingComplete ? "Manage payouts" : "Complete setup",
      color: stripeOnboardingComplete ? "text-indigo-600" : "text-orange-600",
      bgColor: stripeOnboardingComplete ? "bg-indigo-50 hover:bg-indigo-100" : "bg-orange-50 hover:bg-orange-100",
      onClick: () => router.push(`/provider/${providerId}/payments`),
      enabled: true,
      priority: !stripeOnboardingComplete,
    },
    {
      icon: TrendingUp,
      label: "View Analytics",
      description: "Track your performance",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 hover:bg-cyan-100",
      onClick: () => router.push(`/provider/${providerId}/analytics`),
      enabled: true,
    },
    {
      icon: MessageSquare,
      label: "Customer Messages",
      description: "Respond to inquiries",
      color: "text-pink-600",
      bgColor: "bg-pink-50 hover:bg-pink-100",
      onClick: () => router.push(`/provider/${providerId}/messages`),
      enabled: true,
    },
  ];

  // Sort actions to prioritize incomplete payment setup
  const sortedActions = [...actions].sort((a, b) => {
    if (a.priority && !b.priority) return -1;
    if (!a.priority && b.priority) return 1;
    return 0;
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <p className="text-sm text-gray-600">
          Manage your provider account
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedActions.map((action, index) => {
            const Icon = action.icon;
            
            return (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                  variant="outline"
                  className={`w-full h-auto p-4 justify-start group hover:shadow-md transition-all ${
                    action.priority ? "ring-2 ring-orange-500 ring-offset-2" : ""
                  }`}
                  onClick={action.onClick}
                  disabled={!action.enabled}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className={`p-2 rounded-lg ${action.bgColor} transition-colors`}>
                      <Icon className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {action.label}
                        {action.priority && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            Action Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Additional quick actions */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-medium mb-3">More Actions</h4>
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm"
              onClick={() => router.push(`/provider/${providerId}/settings`)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Account Settings
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm"
              onClick={() => router.push(`/provider/${providerId}/help`)}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Help & Resources
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm"
              onClick={() => router.push(`/provider/${providerId}/verification`)}
            >
              <Shield className="h-4 w-4 mr-2" />
              Get Verified
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}