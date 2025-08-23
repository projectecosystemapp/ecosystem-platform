"use client";

import React from 'react';
import { TabTheme } from '@/lib/stores/notebook-store';

interface TabContentProps {
  children: React.ReactNode;
  theme: TabTheme;
}

export default function TabContent({ children, theme }: TabContentProps) {
  return (
    <div 
      className="h-full overflow-auto"
      style={{
        backgroundColor: theme.background,
        color: theme.text,
      }}
    >
      {/* Tab-specific gradient overlay */}
      <div 
        className="fixed top-0 left-20 right-0 h-32 pointer-events-none z-10"
        style={{
          background: `linear-gradient(to bottom, ${theme.background}, transparent)`,
        }}
      />
      
      {/* Content Container */}
      <div className="relative min-h-full">
        {children}
      </div>
      
      {/* Bottom gradient for smooth scrolling appearance */}
      <div 
        className="fixed bottom-0 left-20 right-0 h-20 pointer-events-none z-10"
        style={{
          background: `linear-gradient(to top, ${theme.background}, transparent)`,
        }}
      />
    </div>
  );
}