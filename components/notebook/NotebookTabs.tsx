"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Briefcase, MapPin, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotebookStore, TabId, TAB_THEMES } from '@/lib/stores/notebook-store';

const tabs = [
  { id: 'events' as TabId, label: 'Events', icon: Calendar, color: TAB_THEMES.events.primary },
  { id: 'services' as TabId, label: 'Services', icon: Briefcase, color: TAB_THEMES.services.primary },
  { id: 'spaces' as TabId, label: 'Spaces', icon: MapPin, color: TAB_THEMES.spaces.primary },
  { id: 'profile' as TabId, label: 'Profile', icon: Menu, color: TAB_THEMES.profile.primary },
];

export default function NotebookTabs() {
  const { activeTab, switchTab, setTransitioning } = useNotebookStore();
  
  const handleTabClick = (tabId: TabId) => {
    if (activeTab !== tabId) {
      setTransitioning(true);
      setTimeout(() => {
        switchTab(tabId);
      }, 50);
    }
  };
  
  return (
    <div className="relative w-20 bg-white shadow-xl z-40">
      {/* Tab Container */}
      <div className="relative h-full">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const zIndex = isActive ? 30 : tabs.length - index;
          
          return (
            <motion.div
              key={tab.id}
              className={cn(
                "absolute left-0 w-full cursor-pointer transition-all duration-300",
                "hover:z-50"
              )}
              style={{
                top: `${index * 25}%`,
                height: '25%',
                zIndex,
              }}
              animate={{
                x: isActive ? 10 : 0,
                scale: isActive ? 1.05 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              onClick={() => handleTabClick(tab.id)}
            >
              {/* Tab Background */}
              <div
                className={cn(
                  "relative h-full w-full flex flex-col items-center justify-center",
                  "rounded-l-2xl transition-all duration-300",
                  isActive ? "shadow-lg" : "shadow-md hover:shadow-lg"
                )}
                style={{
                  backgroundColor: isActive ? tab.color : '#FFFFFF',
                  borderRight: isActive ? 'none' : `2px solid ${tab.color}20`,
                }}
              >
                {/* Tab Content */}
                <div className="relative z-10 flex flex-col items-center justify-center space-y-2">
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-all duration-300",
                      isActive ? "text-white" : `text-gray-600`
                    )}
                    style={{
                      color: isActive ? '#FFFFFF' : tab.color,
                    }}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium transition-all duration-300 writing-mode-vertical",
                      isActive ? "text-white" : "text-gray-600"
                    )}
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      color: isActive ? '#FFFFFF' : tab.color,
                    }}
                  >
                    {tab.label}
                  </span>
                </div>
                
                {/* Active Tab Extension */}
                {isActive && (
                  <div
                    className="absolute right-0 top-0 h-full w-4"
                    style={{
                      backgroundColor: tab.color,
                      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
                      transform: 'translateX(100%)',
                    }}
                  />
                )}
                
                {/* Tab Edge Effect */}
                {!isActive && (
                  <div
                    className="absolute inset-0 rounded-l-2xl opacity-0 hover:opacity-10 transition-opacity duration-300"
                    style={{
                      backgroundColor: tab.color,
                    }}
                  />
                )}
              </div>
              
              {/* Paper Stack Effect */}
              {!isActive && (
                <>
                  <div
                    className="absolute inset-0 rounded-l-2xl"
                    style={{
                      backgroundColor: '#F5F5F5',
                      transform: 'translateZ(-1px) translateY(2px)',
                      zIndex: -1,
                    }}
                  />
                  <div
                    className="absolute inset-0 rounded-l-2xl"
                    style={{
                      backgroundColor: '#EBEBEB',
                      transform: 'translateZ(-2px) translateY(4px)',
                      zIndex: -2,
                    }}
                  />
                </>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Bottom Shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none" />
    </div>
  );
}