"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Calendar,
  BarChart3,
  Settings,
  FileText,
  Users,
  MapPin,
  Tag,
  DollarSign,
  LogOut,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface StudioSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
}

export function StudioSidebar({ isOpen, onClose, providerId }: StudioSidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    listings: false,
    bookings: false,
    settings: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/studio",
      icon: LayoutDashboard,
      current: pathname === "/studio",
    },
    {
      name: "Listings",
      icon: Package,
      current: pathname.startsWith("/studio/listings"),
      expandable: true,
      expanded: expandedSections.listings,
      children: [
        { name: "All Listings", href: "/studio/listings", current: pathname === "/studio/listings" },
        { name: "Services", href: "/studio/listings/services", current: pathname === "/studio/listings/services" },
        { name: "Events", href: "/studio/listings/events", current: pathname === "/studio/listings/events" },
        { name: "Spaces", href: "/studio/listings/spaces", current: pathname === "/studio/listings/spaces" },
        { name: "Things", href: "/studio/listings/things", current: pathname === "/studio/listings/things" },
      ],
    },
    {
      name: "Bookings",
      icon: Calendar,
      current: pathname.startsWith("/studio/bookings"),
      expandable: true,
      expanded: expandedSections.bookings,
      children: [
        { name: "Calendar View", href: "/studio/bookings", current: pathname === "/studio/bookings" },
        { name: "Upcoming", href: "/studio/bookings/upcoming", current: pathname === "/studio/bookings/upcoming" },
        { name: "Past", href: "/studio/bookings/past", current: pathname === "/studio/bookings/past" },
      ],
    },
    {
      name: "Analytics",
      href: "/studio/analytics",
      icon: BarChart3,
      current: pathname === "/studio/analytics",
    },
    {
      name: "Settings",
      icon: Settings,
      current: pathname.startsWith("/studio/settings"),
      expandable: true,
      expanded: expandedSections.settings,
      children: [
        { name: "Profile", href: "/studio/settings/profile", current: pathname === "/studio/settings/profile" },
        { name: "Availability", href: "/studio/settings/availability", current: pathname === "/studio/settings/availability" },
        { name: "Payouts", href: "/studio/settings/payouts", current: pathname === "/studio/settings/payouts" },
        { name: "Notifications", href: "/studio/settings/notifications", current: pathname === "/studio/settings/notifications" },
      ],
    },
  ];

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
          <Link href="/studio" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">PS</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Provider Studio</span>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-4 border-b border-gray-200">
          <Button
            className="w-full justify-start"
            size="sm"
            onClick={() => window.location.href = "/studio/listings/create"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Listing
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <ul role="list" className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                {item.expandable ? (
                  <div>
                    <button
                      onClick={() => toggleSection(item.name.toLowerCase())}
                      className={cn(
                        "w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md hover:bg-gray-50",
                        item.current
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:text-gray-900"
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
                        {item.name}
                      </div>
                      {item.expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {item.expanded && (
                      <ul className="mt-1 ml-8 space-y-1">
                        {item.children?.map((child) => (
                          <li key={child.name}>
                            <Link
                              href={child.href}
                              onClick={onClose}
                              className={cn(
                                "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                                child.current
                                  ? "bg-blue-50 text-blue-600"
                                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                              )}
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.href!}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                      item.current
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0",
                        item.current
                          ? "text-blue-600"
                          : "text-gray-400 group-hover:text-gray-500"
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-200 p-4">
          <Link
            href="/dashboard/provider"
            className="flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400" />
            Exit Studio
          </Link>
        </div>
      </div>
    </div>
  );
}