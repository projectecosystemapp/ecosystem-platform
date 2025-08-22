"use client";

import { 
  ArrowUpDown, 
  TrendingUp, 
  DollarSign, 
  Star, 
  Clock,
  MapPin,
  Users
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SortOption = 
  | "relevance" 
  | "rating" 
  | "price_low" 
  | "price_high" 
  | "recent" 
  | "experience"
  | "distance"
  | "popularity";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
  disabled?: boolean;
  showDistanceOption?: boolean;
}

const sortOptions = [
  { 
    value: "relevance" as SortOption, 
    label: "Most Relevant", 
    icon: TrendingUp,
    description: "Best match for your search"
  },
  { 
    value: "rating" as SortOption, 
    label: "Highest Rated", 
    icon: Star,
    description: "Top-rated providers first"
  },
  { 
    value: "price_low" as SortOption, 
    label: "Price: Low to High", 
    icon: DollarSign,
    description: "Most affordable first"
  },
  { 
    value: "price_high" as SortOption, 
    label: "Price: High to Low", 
    icon: DollarSign,
    description: "Premium providers first"
  },
  { 
    value: "recent" as SortOption, 
    label: "Recently Active", 
    icon: Clock,
    description: "Active in the last 7 days"
  },
  { 
    value: "experience" as SortOption, 
    label: "Most Experienced", 
    icon: Users,
    description: "Years of experience"
  },
  { 
    value: "popularity" as SortOption, 
    label: "Most Popular", 
    icon: Users,
    description: "Most bookings"
  },
  { 
    value: "distance" as SortOption, 
    label: "Nearest First", 
    icon: MapPin,
    description: "Closest to your location",
    requiresLocation: true
  },
];

export function SortDropdown({
  value,
  onChange,
  className,
  disabled = false,
  showDistanceOption = false,
}: SortDropdownProps) {
  const selectedOption = sortOptions.find(opt => opt.value === value);
  const Icon = selectedOption?.icon || ArrowUpDown;

  const availableOptions = sortOptions.filter(
    opt => !opt.requiresLocation || showDistanceOption
  );

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("w-[200px]", className)}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Sort by..." />
        </div>
      </SelectTrigger>
      <SelectContent align="end" className="w-[240px]">
        {availableOptions.map((option) => {
          const OptionIcon = option.icon;
          return (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="cursor-pointer"
            >
              <div className="flex items-start gap-2">
                <OptionIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}