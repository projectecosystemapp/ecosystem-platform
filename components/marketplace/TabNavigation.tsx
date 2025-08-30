"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Briefcase, MapPin, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketplaceStore, TabId, TAB_CONFIG } from '@/lib/stores/marketplace-store';
import { Badge } from '@/components/ui/badge';

const TAB_ICONS = {
  events: Calendar,
  services: Briefcase,
  spaces: MapPin,
  things: Package,
} as const;

// Mock data for tab badges (will be replaced with real data)
const TAB_COUNTS = {
  events: 127,
  services: 342,
  spaces: 89,
  things: 456,
};

export default function TabNavigation() {
  const { activeTab, switchTab, getCurrentTheme } = useMarketplaceStore();
  const currentTheme = getCurrentTheme();
  
  const tabs: TabId[] = ['events', 'services', 'spaces', 'things'];
  
  return (
    <nav className="relative">
      {/* Tab Container */}
      <div className="flex items-center justify-center space-x-2 sm:space-x-4">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const config = TAB_CONFIG[tab];
          const isActive = activeTab === tab;
          const theme = useMarketplaceStore.getState().getTabTheme(tab);
          
          return (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={cn(
                "relative flex items-center space-x-2 px-4 sm:px-6 py-2.5 rounded-lg font-medium transition-all duration-200",
                "hover:bg-gray-100/50 focus:outline-none focus:ring-2 focus:ring-offset-2",
                isActive && "text-white"
              )}
              style={{
                color: isActive ? 'white' : theme.muted,
                backgroundColor: isActive ? theme.primary : 'transparent',
              }}
              aria-label={`Switch to ${config.label} tab`}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon */}
              <Icon className="w-5 h-5" />
              
              {/* Label */}
              <span className="hidden sm:inline">{config.label}</span>
              
              {/* Count Badge */}
              {TAB_COUNTS[tab] > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-1.5 px-1.5 py-0 text-xs font-normal",
                    isActive 
                      ? "bg-white/20 text-white border-white/30" 
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  )}
                >
                  {TAB_COUNTS[tab]}
                </Badge>
              )}
              
              {/* Active Indicator Line */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: theme.primary }}
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Mobile Indicator */}
      <div className="sm:hidden absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
    </nav>
  );
}