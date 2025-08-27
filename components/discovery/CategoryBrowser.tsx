"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Grid3X3,
  List,
  ChevronRight,
  ChevronDown,
  Search,
  TrendingUp,
  Star,
  Package,
  Calendar,
  Home,
  Briefcase,
  Heart,
  Zap,
  Users,
  MapPin,
  Clock,
  DollarSign,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: React.ElementType | string;
  color?: string;
  imageUrl?: string;
  itemCount?: number;
  subcategories?: Category[];
  featured?: boolean;
  trending?: boolean;
  parentId?: string | null;
}

export interface CategoryBrowserProps {
  categories?: Category[];
  viewMode?: "grid" | "list";
  showCounts?: boolean;
  showSubcategories?: boolean;
  showSearch?: boolean;
  showTabs?: boolean;
  columns?: number;
  onCategoryClick?: (category: Category) => void;
  className?: string;
}

// Default category icons
const DEFAULT_ICONS: Record<string, React.ElementType> = {
  services: Briefcase,
  events: Calendar,
  spaces: Home,
  things: Package,
  professional: Briefcase,
  home: Home,
  wellness: Heart,
  technology: Zap,
  social: Users,
  local: MapPin,
  urgent: Clock,
  deals: DollarSign,
};

// Mock categories for demonstration
const MOCK_CATEGORIES: Category[] = [
  {
    id: "1",
    name: "Home Services",
    slug: "home-services",
    description: "Professional services for your home",
    icon: Home,
    color: "#10B981",
    itemCount: 245,
    featured: true,
    trending: true,
    subcategories: [
      { id: "1-1", name: "Cleaning", slug: "cleaning", itemCount: 89, parentId: "1" },
      { id: "1-2", name: "Repairs", slug: "repairs", itemCount: 67, parentId: "1" },
      { id: "1-3", name: "Landscaping", slug: "landscaping", itemCount: 45, parentId: "1" },
      { id: "1-4", name: "Painting", slug: "painting", itemCount: 44, parentId: "1" },
    ],
  },
  {
    id: "2",
    name: "Professional Services",
    slug: "professional-services",
    description: "Business and professional expertise",
    icon: Briefcase,
    color: "#3B82F6",
    itemCount: 189,
    featured: true,
    subcategories: [
      { id: "2-1", name: "Consulting", slug: "consulting", itemCount: 56, parentId: "2" },
      { id: "2-2", name: "Legal", slug: "legal", itemCount: 43, parentId: "2" },
      { id: "2-3", name: "Accounting", slug: "accounting", itemCount: 45, parentId: "2" },
      { id: "2-4", name: "Marketing", slug: "marketing", itemCount: 45, parentId: "2" },
    ],
  },
  {
    id: "3",
    name: "Events & Entertainment",
    slug: "events-entertainment",
    description: "Discover local events and entertainment",
    icon: Calendar,
    color: "#8B5CF6",
    itemCount: 342,
    trending: true,
    subcategories: [
      { id: "3-1", name: "Concerts", slug: "concerts", itemCount: 89, parentId: "3" },
      { id: "3-2", name: "Workshops", slug: "workshops", itemCount: 78, parentId: "3" },
      { id: "3-3", name: "Sports", slug: "sports", itemCount: 92, parentId: "3" },
      { id: "3-4", name: "Festivals", slug: "festivals", itemCount: 83, parentId: "3" },
    ],
  },
  {
    id: "4",
    name: "Wellness & Fitness",
    slug: "wellness-fitness",
    description: "Health, wellness, and fitness services",
    icon: Heart,
    color: "#EF4444",
    itemCount: 156,
    subcategories: [
      { id: "4-1", name: "Yoga", slug: "yoga", itemCount: 45, parentId: "4" },
      { id: "4-2", name: "Personal Training", slug: "personal-training", itemCount: 38, parentId: "4" },
      { id: "4-3", name: "Massage", slug: "massage", itemCount: 41, parentId: "4" },
      { id: "4-4", name: "Nutrition", slug: "nutrition", itemCount: 32, parentId: "4" },
    ],
  },
  {
    id: "5",
    name: "Technology",
    slug: "technology",
    description: "Tech services and electronics",
    icon: Zap,
    color: "#F59E0B",
    itemCount: 278,
    featured: true,
    subcategories: [
      { id: "5-1", name: "Computer Repair", slug: "computer-repair", itemCount: 67, parentId: "5" },
      { id: "5-2", name: "Web Development", slug: "web-development", itemCount: 89, parentId: "5" },
      { id: "5-3", name: "IT Support", slug: "it-support", itemCount: 56, parentId: "5" },
      { id: "5-4", name: "Electronics", slug: "electronics", itemCount: 66, parentId: "5" },
    ],
  },
  {
    id: "6",
    name: "Education & Training",
    slug: "education-training",
    description: "Learning and skill development",
    icon: Users,
    color: "#06B6D4",
    itemCount: 198,
    subcategories: [
      { id: "6-1", name: "Tutoring", slug: "tutoring", itemCount: 78, parentId: "6" },
      { id: "6-2", name: "Language", slug: "language", itemCount: 45, parentId: "6" },
      { id: "6-3", name: "Music", slug: "music", itemCount: 42, parentId: "6" },
      { id: "6-4", name: "Art", slug: "art", itemCount: 33, parentId: "6" },
    ],
  },
];

// Tab categories
const TAB_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "services", label: "Services" },
  { value: "events", label: "Events" },
  { value: "spaces", label: "Spaces" },
  { value: "things", label: "Things" },
];

export function CategoryBrowser({
  categories = MOCK_CATEGORIES,
  viewMode: initialViewMode = "grid",
  showCounts = true,
  showSubcategories = true,
  showSearch = true,
  showTabs = true,
  columns = 3,
  onCategoryClick,
  className,
}: CategoryBrowserProps) {
  const router = useRouter();
  
  // State
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState("all");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Filter categories based on search
  const filteredCategories = categories.filter((category) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesCategory = category.name.toLowerCase().includes(query) ||
                           category.description?.toLowerCase().includes(query);
    
    const matchesSubcategory = category.subcategories?.some(
      sub => sub.name.toLowerCase().includes(query)
    );
    
    return matchesCategory || matchesSubcategory;
  });

  // Filter by tab if needed
  const displayCategories = showTabs && selectedTab !== "all"
    ? filteredCategories.filter(cat => cat.slug.includes(selectedTab))
    : filteredCategories;

  // Toggle category expansion
  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle category click
  const handleCategoryClick = (category: Category, event?: React.MouseEvent) => {
    // If clicking on expand button, don't navigate
    if (event && (event.target as HTMLElement).closest('.expand-button')) {
      return;
    }

    if (onCategoryClick) {
      onCategoryClick(category);
    } else {
      // Default behavior: navigate to marketplace with category filter
      router.push(`/marketplace?category=${category.slug}`);
    }
  };

  // Get icon component
  const getIcon = (category: Category): React.ElementType => {
    if (typeof category.icon === "string") {
      return DEFAULT_ICONS[category.icon] || Package;
    }
    return category.icon || DEFAULT_ICONS[category.slug] || Package;
  };

  // Render category card
  const renderCategoryCard = (category: Category) => {
    const Icon = getIcon(category);
    const isExpanded = expandedCategories.has(category.id);
    const hasSubcategories = category.subcategories && category.subcategories.length > 0;

    return (
      <motion.div
        key={category.id}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ y: -4 }}
        onHoverStart={() => setHoveredCategory(category.id)}
        onHoverEnd={() => setHoveredCategory(null)}
      >
        <Card
          className={cn(
            "relative overflow-hidden cursor-pointer transition-all duration-200",
            "hover:shadow-xl hover:border-primary/50",
            viewMode === "list" && "flex"
          )}
          onClick={(e) => handleCategoryClick(category, e)}
          style={{
            borderColor: hoveredCategory === category.id ? category.color : undefined,
          }}
        >
          {/* Featured/Trending Badge */}
          {(category.featured || category.trending) && (
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              {category.featured && (
                <Badge variant="default" className="bg-yellow-500">
                  <Star className="mr-1 h-3 w-3" />
                  Featured
                </Badge>
              )}
              {category.trending && (
                <Badge variant="secondary">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Trending
                </Badge>
              )}
            </div>
          )}

          <CardHeader className={cn(viewMode === "list" && "flex-row items-center gap-4")}>
            {/* Icon */}
            <div
              className={cn(
                "inline-flex items-center justify-center rounded-lg p-3",
                viewMode === "grid" ? "h-14 w-14" : "h-12 w-12"
              )}
              style={{ backgroundColor: `${category.color}20` }}
            >
              <Icon
                className="h-6 w-6"
                style={{ color: category.color }}
              />
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center justify-between">
                {category.name}
                {hasSubcategories && showSubcategories && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="expand-button h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(category.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </CardTitle>
              {category.description && (
                <CardDescription className="mt-1">
                  {category.description}
                </CardDescription>
              )}
            </div>

            {/* Item Count */}
            {showCounts && category.itemCount !== undefined && (
              <div className={cn(
                "text-right",
                viewMode === "list" && "ml-auto"
              )}>
                <div className="text-2xl font-bold" style={{ color: category.color }}>
                  {category.itemCount}
                </div>
                <div className="text-xs text-muted-foreground">listings</div>
              </div>
            )}
          </CardHeader>

          {/* Subcategories */}
          {hasSubcategories && showSubcategories && isExpanded && (
            <CardContent className="pt-0">
              <div className="grid gap-2">
                {category.subcategories!.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryClick(subcategory);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <span className="text-sm">{subcategory.name}</span>
                    {showCounts && subcategory.itemCount !== undefined && (
                      <Badge variant="secondary">
                        {subcategory.itemCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </motion.div>
    );
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-6", className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Browse Categories</h2>
            <p className="text-muted-foreground">
              Explore our marketplace by category
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List View</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="pl-10"
            />
          </div>
        )}

        {/* Category Tabs */}
        {showTabs && (
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              {TAB_CATEGORIES.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Categories Grid/List */}
        <AnimatePresence mode="wait">
          {displayCategories.length > 0 ? (
            <motion.div
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                viewMode === "grid"
                  ? `grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`
                  : "space-y-4"
              )}
            >
              {displayCategories.map(renderCategoryCard)}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No categories found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? `No categories match "${searchQuery}"`
                  : "No categories available"}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Popular Categories Summary */}
        {!searchQuery && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Popular Right Now</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter((cat) => cat.featured || cat.trending)
                  .slice(0, 8)
                  .map((category) => (
                    <Badge
                      key={category.id}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleCategoryClick(category)}
                    >
                      {category.name}
                      {showCounts && category.itemCount && (
                        <span className="ml-1">({category.itemCount})</span>
                      )}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}