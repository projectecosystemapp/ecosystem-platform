"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMarketplaceStore, TabId, TAB_THEMES } from '@/lib/stores/marketplace-store';
import TabNavigation from './TabNavigation';
import ContextualSearch from './ContextualSearch';

interface MarketplaceLayoutProps {
  children: React.ReactNode;
  initialTab?: TabId;
}

export default function MarketplaceLayout({ children, initialTab = 'events' }: MarketplaceLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activeTab,
    switchTab,
    getCurrentTheme,
    isTransitioning,
  } = useMarketplaceStore();
  
  const [mounted, setMounted] = useState(false);
  const currentTheme = getCurrentTheme();
  
  // Initialize on mount
  useEffect(() => {
    setMounted(true);
    
    // Set initial tab based on URL
    const pathSegments = pathname.split('/');
    const tabFromPath = pathSegments[2] as TabId;
    
    if (tabFromPath && ['events', 'services', 'spaces', 'things'].includes(tabFromPath)) {
      switchTab(tabFromPath);
    } else if (initialTab) {
      switchTab(initialTab);
    }
  }, []);
  
  // Update URL when tab changes
  useEffect(() => {
    if (mounted) {
      const newPath = `/app/${activeTab}`;
      if (pathname !== newPath) {
        router.push(newPath, { scroll: false });
      }
    }
  }, [activeTab, mounted]);
  
  // Apply theme to CSS variables
  useEffect(() => {
    if (mounted && currentTheme) {
      const root = document.documentElement;
      
      // Smooth theme transition
      root.style.transition = 'background-color 0.3s ease, border-color 0.3s ease';
      
      // Apply theme colors as CSS variables
      Object.entries(currentTheme).forEach(([key, value]) => {
        root.style.setProperty(`--theme-${key}`, value);
      });
      
      // Update body background
      document.body.style.backgroundColor = currentTheme.background;
    }
  }, [currentTheme, mounted]);
  
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundColor: currentTheme.background,
        color: currentTheme.text,
      }}
    >
      {/* Header Section with Tabs and Search */}
      <div 
        className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-md"
        style={{
          borderColor: currentTheme.border,
          backgroundColor: `${currentTheme.surface}f2`, // 95% opacity
        }}
      >
        <div className="container mx-auto px-4 py-4">
          {/* Tab Navigation */}
          <TabNavigation />
          
          {/* Contextual Search Bar */}
          <div className="mt-4">
            <ContextualSearch />
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ 
              duration: 0.2,
              ease: [0.25, 0.1, 0.25, 1]
            }}
            className="min-h-[calc(100vh-200px)]"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Transition Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-50"
            style={{
              background: `linear-gradient(135deg, ${currentTheme.primary}10 0%, transparent 100%)`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}