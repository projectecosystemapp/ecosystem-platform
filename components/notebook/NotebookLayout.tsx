"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Briefcase, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotebookStore, TabId, TAB_THEMES } from '@/lib/stores/notebook-store';
import NotebookTabs from './NotebookTabs';
import TabContent from './TabContent';

interface NotebookLayoutProps {
  children: React.ReactNode;
  initialTab?: TabId;
}

export default function NotebookLayout({ children, initialTab = 'events' }: NotebookLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activeTab,
    switchTab,
    getCurrentTheme,
    isTransitioning,
  } = useNotebookStore();
  
  const [mounted, setMounted] = useState(false);
  const currentTheme = getCurrentTheme();
  
  // Initialize on mount
  useEffect(() => {
    setMounted(true);
    
    // Set initial tab based on URL
    const pathSegments = pathname.split('/');
    const tabFromPath = pathSegments[2] as TabId;
    
    if (tabFromPath && ['events', 'services', 'spaces', 'profile'].includes(tabFromPath)) {
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
      
      // Animate theme transition
      root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
      
      // Apply theme colors
      Object.entries(currentTheme).forEach(([key, value]) => {
        root.style.setProperty(`--theme-${key}`, value);
      });
      
      // Set specific CSS variables for Tailwind
      root.style.setProperty('--primary', currentTheme.primary);
      root.style.setProperty('--primary-foreground', '#FFFFFF');
      root.style.setProperty('--secondary', currentTheme.secondary);
      root.style.setProperty('--accent', currentTheme.accent);
      root.style.setProperty('--background', currentTheme.background);
      root.style.setProperty('--foreground', currentTheme.text);
      root.style.setProperty('--muted', currentTheme.muted);
      root.style.setProperty('--muted-foreground', currentTheme.muted);
      
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
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: currentTheme.background,
        color: currentTheme.text,
      }}
    >
      {/* Vertical Tab Navigation */}
      <NotebookTabs />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ 
              duration: 0.3,
              ease: [0.25, 0.1, 0.25, 1]
            }}
            className="h-full"
          >
            <TabContent theme={currentTheme}>
              {children}
            </TabContent>
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
              background: `linear-gradient(135deg, ${currentTheme.primary}20 0%, transparent 100%)`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}