"use client";

import { useState } from "react";
import { 
  MapPin, 
  DollarSign, 
  Star, 
  Filter,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Calendar,
  Shield,
  Award,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LocationFilter } from "./LocationFilter";

export interface FilterValues {
  query?: string;
  location?: {
    city?: string;
    state?: string;
    zipCode?: string;
    radius?: number;
  };
  priceRange: [number, number];
  minRating: number;
  services: string[];
  availability?: {
    days?: string[];
    timeOfDay?: string[];
  };
  experience?: {
    min?: number;
    max?: number;
  };
  verifiedOnly: boolean;
  hasInsurance: boolean;
  instantBooking: boolean;
}

interface SearchFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  className?: string;
  isLoading?: boolean;
  availableServices?: Array<{ id: string; name: string; count: number }>;
}

export function SearchFilters({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  className,
  isLoading = false,
  availableServices = [],
}: SearchFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["location", "price", "rating"])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const hasActiveFilters = 
    filters.location?.city ||
    filters.location?.state ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 500 ||
    filters.minRating > 0 ||
    filters.services.length > 0 ||
    filters.verifiedOnly ||
    filters.hasInsurance ||
    filters.instantBooking;

  const activeFilterCount = [
    filters.location?.city || filters.location?.state,
    filters.priceRange[0] > 0 || filters.priceRange[1] < 500,
    filters.minRating > 0,
    filters.services.length > 0,
    filters.verifiedOnly,
    filters.hasInsurance,
    filters.instantBooking,
  ].filter(Boolean).length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h3 className="font-semibold">Filters</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      <Separator />

      {/* Location Filter */}
      <Collapsible 
        open={expandedSections.has("location")}
        onOpenChange={() => toggleSection("location")}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto font-medium"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </div>
            {expandedSections.has("location") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <LocationFilter
            city={filters.location?.city || ""}
            state={filters.location?.state || ""}
            zipCode={filters.location?.zipCode || ""}
            radius={filters.location?.radius || 25}
            onLocationChange={(location) => 
              onFiltersChange({ ...filters, location })
            }
          />
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Price Range */}
      <Collapsible 
        open={expandedSections.has("price")}
        onOpenChange={() => toggleSection("price")}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto font-medium"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Price Range
            </div>
            {expandedSections.has("price") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Hourly Rate</Label>
              <span className="text-sm font-medium">
                ${filters.priceRange[0]} - ${filters.priceRange[1]}
                {filters.priceRange[1] >= 500 && "+"}
              </span>
            </div>
            <Slider
              value={filters.priceRange}
              onValueChange={(value) => 
                onFiltersChange({ 
                  ...filters, 
                  priceRange: value as [number, number] 
                })
              }
              min={0}
              max={500}
              step={25}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$0</span>
              <span>$500+</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Rating */}
      <Collapsible 
        open={expandedSections.has("rating")}
        onOpenChange={() => toggleSection("rating")}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto font-medium"
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Rating
            </div>
            {expandedSections.has("rating") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="grid grid-cols-2 gap-2">
            {[0, 3, 4, 4.5].map((rating) => (
              <Button
                key={rating}
                variant={filters.minRating === rating ? "default" : "outline"}
                size="sm"
                onClick={() => 
                  onFiltersChange({ ...filters, minRating: rating })
                }
                className="justify-start"
              >
                {rating === 0 ? (
                  "Any"
                ) : (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    <span>{rating}+</span>
                  </div>
                )}
              </Button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Services */}
      {availableServices.length > 0 && (
        <>
          <Collapsible 
            open={expandedSections.has("services")}
            onOpenChange={() => toggleSection("services")}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-0 h-auto font-medium"
              >
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Services
                  {filters.services.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {filters.services.length}
                    </Badge>
                  )}
                </div>
                {expandedSections.has("services") ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-2">
              {availableServices.slice(0, 10).map((service) => (
                <div key={service.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={service.id}
                    checked={filters.services.includes(service.id)}
                    onCheckedChange={(checked) => {
                      const newServices = checked
                        ? [...filters.services, service.id]
                        : filters.services.filter((s) => s !== service.id);
                      onFiltersChange({ ...filters, services: newServices });
                    }}
                  />
                  <Label
                    htmlFor={service.id}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {service.name}
                    <span className="text-muted-foreground ml-1">
                      ({service.count})
                    </span>
                  </Label>
                </div>
              ))}
              {availableServices.length > 10 && (
                <Button variant="link" size="sm" className="p-0 h-auto">
                  Show {availableServices.length - 10} more
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
          <Separator />
        </>
      )}

      {/* Availability */}
      <Collapsible 
        open={expandedSections.has("availability")}
        onOpenChange={() => toggleSection("availability")}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto font-medium"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Availability
            </div>
            {expandedSections.has("availability") ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Days</Label>
            <div className="grid grid-cols-2 gap-2">
              {["Weekdays", "Weekends", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].slice(0, 2).map((day) => (
                <Button
                  key={day}
                  variant={
                    filters.availability?.days?.includes(day) 
                      ? "default" 
                      : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    const currentDays = filters.availability?.days || [];
                    const newDays = currentDays.includes(day)
                      ? currentDays.filter((d) => d !== day)
                      : [...currentDays, day];
                    onFiltersChange({
                      ...filters,
                      availability: { ...filters.availability, days: newDays },
                    });
                  }}
                  className="justify-start"
                >
                  {day}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm">Time of Day</Label>
            <div className="grid grid-cols-2 gap-2">
              {["Morning", "Afternoon", "Evening", "Night"].map((time) => (
                <Button
                  key={time}
                  variant={
                    filters.availability?.timeOfDay?.includes(time) 
                      ? "default" 
                      : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    const currentTimes = filters.availability?.timeOfDay || [];
                    const newTimes = currentTimes.includes(time)
                      ? currentTimes.filter((t) => t !== time)
                      : [...currentTimes, time];
                    onFiltersChange({
                      ...filters,
                      availability: { 
                        ...filters.availability, 
                        timeOfDay: newTimes 
                      },
                    });
                  }}
                  className="justify-start text-xs"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {time}
                </Button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Additional Filters */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Additional Filters</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="verified"
              checked={filters.verifiedOnly}
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, verifiedOnly: checked as boolean })
              }
            />
            <Label
              htmlFor="verified"
              className="text-sm font-normal cursor-pointer flex items-center gap-1"
            >
              <Shield className="h-3 w-3 text-blue-500" />
              Verified Providers Only
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="insurance"
              checked={filters.hasInsurance}
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, hasInsurance: checked as boolean })
              }
            />
            <Label
              htmlFor="insurance"
              className="text-sm font-normal cursor-pointer"
            >
              Has Insurance
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="instant"
              checked={filters.instantBooking}
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, instantBooking: checked as boolean })
              }
            />
            <Label
              htmlFor="instant"
              className="text-sm font-normal cursor-pointer"
            >
              Instant Booking Available
            </Label>
          </div>
        </div>
      </div>

      {/* Apply Filters Button */}
      <Button 
        onClick={onApplyFilters} 
        className="w-full"
        disabled={isLoading}
      >
        Apply Filters
      </Button>
    </div>
  );
}