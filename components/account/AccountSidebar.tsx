"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Heart,
  Trophy,
  User,
  LogOut,
  ShoppingBag,
  Star,
  Settings,
  Wallet,
  History,
  CreditCard,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserButton } from "@clerk/nextjs";

interface AccountSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  loyaltyData?: {
    pointsBalance: number;
    tier: string;
  } | null;
}

export function AccountSidebar({ 
  isOpen, 
  onClose, 
  userId, 
  userEmail,
  loyaltyData 
}: AccountSidebarProps) {
  const pathname = usePathname();

  const navigation = [
    {
      name: "Dashboard",
      href: "/account",
      icon: LayoutDashboard,
      current: pathname === "/account",
      description: "Overview of your account",
    },
    {
      name: "My Bookings",
      href: "/account/bookings",
      icon: Calendar,
      current: pathname === "/account/bookings",
      description: "View and manage bookings",
    },
    {
      name: "Favorites",
      href: "/account/favorites",
      icon: Heart,
      current: pathname === "/account/favorites",
      description: "Your saved items",
    },
    {
      name: "Loyalty Points",
      href: "/account/loyalty",
      icon: Trophy,
      current: pathname === "/account/loyalty",
      description: "Points and rewards",
      badge: loyaltyData?.pointsBalance ? `${loyaltyData.pointsBalance} pts` : null,
    },
    {
      name: "Profile Settings",
      href: "/account/settings",
      icon: Settings,
      current: pathname === "/account/settings",
      description: "Manage your profile",
    },
  ];

  const quickActions = [
    {
      name: "Browse Marketplace",
      href: "/marketplace",
      icon: ShoppingBag,
    },
    {
      name: "View History",
      href: "/account/bookings?filter=past",
      icon: History,
    },
    {
      name: "Payment Methods",
      href: "/account/settings?tab=payment",
      icon: CreditCard,
    },
  ];

  const getTierColor = (tier: string) => {
    const tierColors: Record<string, string> = {
      bronze: "bg-orange-100 text-orange-800",
      silver: "bg-gray-100 text-gray-800",
      gold: "bg-yellow-100 text-yellow-800",
      platinum: "bg-purple-100 text-purple-800",
      diamond: "bg-blue-100 text-blue-800",
    };
    return tierColors[tier] || "bg-gray-100 text-gray-800";
  };

  const getInitials = (email: string) => {
    return email ? email.substring(0, 2).toUpperCase() : "U";
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo/Brand */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
          <Link href="/account" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">EC</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">My Account</span>
          </Link>
        </div>

        {/* User Profile Section */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10"
                }
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userEmail}
              </p>
              {loyaltyData && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className={cn("text-xs capitalize", getTierColor(loyaltyData.tier))}
                  >
                    {loyaltyData.tier}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {loyaltyData.pointsBalance} points
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="space-y-1">
            <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Main Menu
            </h3>
            <ul role="list" className="mt-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center justify-between px-2 py-2.5 text-sm font-medium rounded-md transition-colors",
                      item.current
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={cn(
                          "mr-3 h-5 w-5 flex-shrink-0",
                          item.current
                            ? "text-blue-600"
                            : "text-gray-400 group-hover:text-gray-500"
                        )}
                        aria-hidden="true"
                      />
                      <div>
                        <div>{item.name}</div>
                        <div className="text-xs text-gray-500 font-normal">
                          {item.description}
                        </div>
                      </div>
                    </div>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 space-y-1">
            <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick Actions
            </h3>
            <ul role="list" className="mt-2 space-y-1">
              {quickActions.map((action) => (
                <li key={action.name}>
                  <Link
                    href={action.href}
                    onClick={onClose}
                    className="group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <action.icon
                      className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500"
                      aria-hidden="true"
                    />
                    {action.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-200 p-4">
          <Link
            href="/marketplace"
            className="flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400" />
            Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}