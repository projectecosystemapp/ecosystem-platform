"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wrench, 
  MessageSquare, 
  Calendar, 
  Building2,
  Search
} from "lucide-react";

export type CategoryType = "services" | "wanted" | "events" | "spaces";

interface Category {
  id: CategoryType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const categories: Category[] = [
  {
    id: "services",
    label: "Services",
    icon: <Wrench className="w-5 h-5" />,
    color: "services",
    description: "Find trusted service providers"
  },
  {
    id: "wanted",
    label: "Wanted",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "wanted",
    description: "Browse requests and opportunities"
  },
  {
    id: "events",
    label: "Events",
    icon: <Calendar className="w-5 h-5" />,
    color: "events",
    description: "Discover and host events"
  },
  {
    id: "spaces",
    label: "Spaces",
    icon: <Building2 className="w-5 h-5" />,
    color: "spaces",
    description: "Rent unique spaces"
  }
];

interface CategoryTabsProps {
  activeCategory: CategoryType;
  onCategoryChange: (category: CategoryType) => void;
  className?: string;
}

export function CategoryTabs({ 
  activeCategory, 
  onCategoryChange,
  className 
}: CategoryTabsProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Tab Container */}
      <div className="relative">
        {/* Desktop Layout */}
        <div className="hidden md:flex justify-center items-end gap-0.5 px-4">
          {categories.map((category) => (
            <NotebookTab
              key={category.id}
              category={category}
              isActive={activeCategory === category.id}
              onClick={() => onCategoryChange(category.id)}
            />
          ))}
        </div>

        {/* Mobile Layout - Vertical Stack */}
        <div className="md:hidden px-4 space-y-2">
          {categories.map((category) => (
            <MobileTab
              key={category.id}
              category={category}
              isActive={activeCategory === category.id}
              onClick={() => onCategoryChange(category.id)}
            />
          ))}
        </div>
      </div>

      {/* Search Bar Section */}
      <SearchBar activeCategory={activeCategory} />
    </div>
  );
}

// Individual Notebook Tab Component
function NotebookTab({ 
  category, 
  isActive, 
  onClick 
}: { 
  category: Category;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative px-6 py-3 rounded-t-xl border border-b-0 tab-transition",
        "min-w-[120px] group",
        isActive ? [
          "bg-white z-10",
          `category-${category.color}`,
          "shadow-lg"
        ] : [
          "bg-gradient-to-b from-gray-50 to-gray-100",
          "border-gray-200",
          "hover:bg-gray-50",
          "transform translate-y-1"
        ]
      )}
      whileHover={{ y: isActive ? 0 : -2 }}
      whileTap={{ scale: 0.98 }}
      animate={{
        y: isActive ? 0 : 4,
        scale: isActive ? 1 : 0.98
      }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col items-center gap-1">
        <motion.div
          className={cn(
            "transition-colors",
            isActive ? "text-[var(--category-primary)]" : "text-gray-500"
          )}
          animate={{ scale: isActive ? 1.1 : 1 }}
          transition={{ duration: 0.2 }}
        >
          {category.icon}
        </motion.div>
        <span className={cn(
          "text-sm font-medium transition-colors",
          isActive ? "text-[var(--category-primary)]" : "text-gray-600"
        )}>
          {category.label}
        </span>
      </div>

      {/* Active indicator border */}
      {isActive && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--category-primary)]"
          layoutId="activeTab"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

// Mobile Tab Component
function MobileTab({ 
  category, 
  isActive, 
  onClick 
}: { 
  category: Category;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3 rounded-lg border tab-transition",
        "flex items-center gap-3",
        isActive ? [
          "bg-white",
          `category-${category.color}`,
          "border-[var(--category-primary)]",
          "shadow-md"
        ] : [
          "bg-gray-50",
          "border-gray-200",
          "hover:bg-gray-100"
        ]
      )}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        className={cn(
          "transition-colors",
          isActive ? "text-[var(--category-primary)]" : "text-gray-500"
        )}
        animate={{ scale: isActive ? 1.1 : 1 }}
      >
        {category.icon}
      </motion.div>
      <div className="flex-1 text-left">
        <div className={cn(
          "font-medium transition-colors",
          isActive ? "text-[var(--category-primary)]" : "text-gray-700"
        )}>
          {category.label}
        </div>
        <div className="text-xs text-gray-500">
          {category.description}
        </div>
      </div>
    </motion.button>
  );
}

// Context-Aware Search Bar
function SearchBar({ activeCategory }: { activeCategory: CategoryType }) {
  const placeholders = {
    services: "What service do you need?",
    wanted: "What are you looking for?",
    events: "Find events near you",
    spaces: "Search for spaces"
  };

  const searchButtons = {
    services: "Available Now",
    wanted: "Post Request",
    events: "This Weekend",
    spaces: "Book Space"
  };

  return (
    <div className={cn(
      "w-full px-4 py-6 bg-white border-t",
      `category-${activeCategory}`
    )}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Main Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <AnimatePresence mode="wait">
              <motion.input
                key={activeCategory}
                type="text"
                placeholder={placeholders[activeCategory]}
                className={cn(
                  "w-full pl-10 pr-4 py-3 rounded-lg border",
                  "focus:outline-none focus:ring-2 transition-all",
                  "border-gray-200 focus:border-[var(--category-primary)]",
                  "focus:ring-[var(--category-primary)]/20"
                )}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              />
            </AnimatePresence>
          </div>

          {/* Location Input */}
          <input
            type="text"
            placeholder="Location"
            className="w-full md:w-48 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--category-primary)]/20"
          />

          {/* Category-Specific Action Button */}
          <AnimatePresence mode="wait">
            <motion.button
              key={activeCategory}
              className={cn(
                "px-6 py-3 rounded-lg font-medium text-white",
                "bg-[var(--category-primary)] hover:bg-[var(--category-hover)]",
                "transition-colors"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {searchButtons[activeCategory]}
            </motion.button>
          </AnimatePresence>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {activeCategory === "services" && (
            <>
              <FilterChip label="⚡ Available Now" />
              <FilterChip label="⭐ Top Rated" />
              <FilterChip label="💰 Budget Friendly" />
            </>
          )}
          {activeCategory === "wanted" && (
            <>
              <FilterChip label="📝 Recent" />
              <FilterChip label="💸 High Budget" />
              <FilterChip label="🔥 Urgent" />
            </>
          )}
          {activeCategory === "events" && (
            <>
              <FilterChip label="📅 Today" />
              <FilterChip label="👥 Group Friendly" />
              <FilterChip label="🎟️ Free Entry" />
            </>
          )}
          {activeCategory === "spaces" && (
            <>
              <FilterChip label="📍 Near Me" />
              <FilterChip label="🏢 Large Capacity" />
              <FilterChip label="💼 Professional" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Filter Chip Component
function FilterChip({ label }: { label: string }) {
  return (
    <button className="px-3 py-1.5 text-sm rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
      {label}
    </button>
  );
}

export default CategoryTabs;
