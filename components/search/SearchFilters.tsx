"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Users,
  Home,
  Package,
  Star,
  DollarSign,
  MapPin,
  Wifi,
  Car,
  Shield,
  Tag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

// Types
export interface FilterState {
  // Common filters
  priceRange?: { min: number; max: number };
  location?: {
    lat: number;
    lng: number;
    radius: number;
  };
  rating?: number;
  
  // Service filters
  serviceType?: string;
  availability?: "available" | "busy" | "offline";
  instantBooking?: boolean;
  providerVerified?: boolean;
  serviceDuration?: { min: number; max: number };
  
  // Event filters
  eventDateRange?: { start: Date; end: Date };
  eventType?: string;
  isVirtual?: boolean;
  hasTickets?: boolean;
  eventCapacity?: { min: number; max: number };
  
  // Space filters
  spaceType?: string;
  spaceCapacity?: { min: number; max: number };
  squareFeet?: { min: number; max: number };
  amenities?: string[];
  priceUnit?: "hour" | "day" | "week" | "month";
  
  // Thing filters
  condition?: "new" | "like_new" | "good" | "fair" | "for_parts";
  brand?: string;
  isNegotiable?: boolean;
  shippingAvailable?: boolean;
  localPickupOnly?: boolean;
}

interface SearchFiltersProps {
  vertical: "services" | "events" | "spaces" | "things" | "all";
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApply?: () => void;
  onReset?: () => void;
  categories?: Array<{ id: string; name: string; slug: string }>;
  className?: string;
  isMobile?: boolean;
}

// Filter sections configuration
const SERVICE_AMENITIES = [
  "Online Booking",
  "Insurance Coverage",
  "Licensed Professional",
  "Background Checked",
  "Same Day Service",
  "Emergency Service",
  "Free Consultation",
  "Satisfaction Guarantee",
];

const SPACE_AMENITIES = [
  { value: "wifi", label: "WiFi", icon: Wifi },
  { value: "parking", label: "Parking", icon: Car },
  { value: "wheelchair", label: "Wheelchair Access", icon: Users },
  { value: "kitchen", label: "Kitchen", icon: Home },
  { value: "ac", label: "Air Conditioning", icon: Home },
  { value: "heating", label: "Heating", icon: Home },
  { value: "projector", label: "Projector", icon: Package },
  { value: "whiteboard", label: "Whiteboard", icon: Package },
];

const THING_CONDITIONS = [
  { value: "new", label: "New", description: "Brand new, unused" },
  { value: "like_new", label: "Like New", description: "Barely used, excellent condition" },
  { value: "good", label: "Good", description: "Used but well maintained" },
  { value: "fair", label: "Fair", description: "Shows wear, fully functional" },
  { value: "for_parts", label: "For Parts", description: "Not working, for parts only" },
];

export function SearchFilters({
  vertical,
  filters,
  onFiltersChange,
  onApply,
  onReset,
  categories = [],
  className,
  isMobile = false,
}: SearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["price", "category"])
  );
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Count active filters
  useEffect(() => {
    let count = 0;
    Object.values(localFilters).forEach((value) => {
      if (value !== undefined && value !== null) {
        if (typeof value === "object" && !Array.isArray(value)) {
          if (Object.values(value).some(v => v !== undefined && v !== null)) {
            count++;
          }
        } else if (Array.isArray(value) && value.length > 0) {
          count++;
        } else if (value) {
          count++;
        }
      }
    });
    setActiveFilterCount(count);
  }, [localFilters]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Update filter value
  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Handle apply filters
  const handleApply = () => {
    onFiltersChange(localFilters);
    if (onApply) onApply();
  };

  // Handle reset filters
  const handleReset = () => {
    setLocalFilters({});
    onFiltersChange({});
    if (onReset) onReset();
  };

  // Render filter section
  const renderFilterSection = (
    title: string,
    key: string,
    children: React.ReactNode,
    icon?: React.ReactNode
  ) => (
    <Collapsible
      open={expandedSections.has(key)}
      onOpenChange={() => toggleSection(key)}
      className="space-y-2"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded-lg">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        {expandedSections.has(key) ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-4 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

  // Common price filter
  const renderPriceFilter = () => {
    const min = localFilters.priceRange?.min || 0;
    const max = localFilters.priceRange?.max || 1000;

    return renderFilterSection(
      "Price Range",
      "price",
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="min-price" className="text-xs">Min</Label>
            <Input
              id="min-price"
              type="number"
              value={min}
              onChange={(e) => updateFilter("priceRange", {
                min: parseInt(e.target.value) || 0,
                max
              })}
              className="h-8"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="max-price" className="text-xs">Max</Label>
            <Input
              id="max-price"
              type="number"
              value={max}
              onChange={(e) => updateFilter("priceRange", {
                min,
                max: parseInt(e.target.value) || 1000
              })}
              className="h-8"
            />
          </div>
        </div>
        <Slider
          value={[min, max]}
          onValueChange={([newMin, newMax]) => updateFilter("priceRange", {
            min: newMin,
            max: newMax
          })}
          min={0}
          max={1000}
          step={10}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${min}</span>
          <span>${max}</span>
        </div>
      </div>,
      <DollarSign className="h-4 w-4" />
    );
  };

  // Common rating filter
  const renderRatingFilter = () => {
    return renderFilterSection(
      "Minimum Rating",
      "rating",
      <RadioGroup
        value={localFilters.rating?.toString() || "0"}
        onValueChange={(value) => updateFilter("rating", parseFloat(value))}
      >
        {[0, 3, 3.5, 4, 4.5].map((rating) => (
          <div key={rating} className="flex items-center space-x-2">
            <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
            <Label htmlFor={`rating-${rating}`} className="flex items-center gap-1 cursor-pointer">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{rating === 0 ? "Any" : `${rating}+`}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>,
      <Star className="h-4 w-4" />
    );
  };

  // Service-specific filters
  const renderServiceFilters = () => (
    <>
      {renderFilterSection(
        "Availability",
        "availability",
        <RadioGroup
          value={localFilters.availability || "all"}
          onValueChange={(value) => updateFilter("availability", value === "all" ? undefined : value)}
        >
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="avail-all" />
              <Label htmlFor="avail-all">All</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="available" id="avail-available" />
              <Label htmlFor="avail-available">Available Now</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="busy" id="avail-busy" />
              <Label htmlFor="avail-busy">Busy</Label>
            </div>
          </div>
        </RadioGroup>,
        <Clock className="h-4 w-4" />
      )}
      
      {renderFilterSection(
        "Booking Options",
        "booking",
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="instant-booking" className="text-sm">Instant Booking</Label>
            <Switch
              id="instant-booking"
              checked={localFilters.instantBooking || false}
              onCheckedChange={(checked) => updateFilter("instantBooking", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="verified-provider" className="text-sm">Verified Provider</Label>
            <Switch
              id="verified-provider"
              checked={localFilters.providerVerified || false}
              onCheckedChange={(checked) => updateFilter("providerVerified", checked)}
            />
          </div>
        </div>,
        <Shield className="h-4 w-4" />
      )}
    </>
  );

  // Event-specific filters
  const renderEventFilters = () => (
    <>
      {renderFilterSection(
        "Event Date",
        "eventDate",
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {localFilters.eventDateRange?.start ? (
                    format(localFilters.eventDateRange.start, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={localFilters.eventDateRange?.start}
                  onSelect={(date) => date && updateFilter("eventDateRange", {
                    ...localFilters.eventDateRange,
                    start: date
                  })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {localFilters.eventDateRange?.end ? (
                    format(localFilters.eventDateRange.end, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={localFilters.eventDateRange?.end}
                  onSelect={(date) => date && updateFilter("eventDateRange", {
                    ...localFilters.eventDateRange,
                    end: date
                  })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>,
        <Calendar className="h-4 w-4" />
      )}
      
      {renderFilterSection(
        "Event Type",
        "eventType",
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="virtual-event" className="text-sm">Virtual Events</Label>
            <Switch
              id="virtual-event"
              checked={localFilters.isVirtual || false}
              onCheckedChange={(checked) => updateFilter("isVirtual", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="has-tickets" className="text-sm">Tickets Available</Label>
            <Switch
              id="has-tickets"
              checked={localFilters.hasTickets || false}
              onCheckedChange={(checked) => updateFilter("hasTickets", checked)}
            />
          </div>
        </div>,
        <Users className="h-4 w-4" />
      )}
    </>
  );

  // Space-specific filters
  const renderSpaceFilters = () => (
    <>
      {renderFilterSection(
        "Space Details",
        "spaceDetails",
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Capacity (people)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.spaceCapacity?.min || ""}
                onChange={(e) => updateFilter("spaceCapacity", {
                  min: parseInt(e.target.value) || 0,
                  max: localFilters.spaceCapacity?.max || 100
                })}
                className="h-8"
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.spaceCapacity?.max || ""}
                onChange={(e) => updateFilter("spaceCapacity", {
                  min: localFilters.spaceCapacity?.min || 0,
                  max: parseInt(e.target.value) || 100
                })}
                className="h-8"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Size (sq ft)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.squareFeet?.min || ""}
                onChange={(e) => updateFilter("squareFeet", {
                  min: parseInt(e.target.value) || 0,
                  max: localFilters.squareFeet?.max || 10000
                })}
                className="h-8"
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.squareFeet?.max || ""}
                onChange={(e) => updateFilter("squareFeet", {
                  min: localFilters.squareFeet?.min || 0,
                  max: parseInt(e.target.value) || 10000
                })}
                className="h-8"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Rental Period</Label>
            <Select
              value={localFilters.priceUnit || "hour"}
              onValueChange={(value: any) => updateFilter("priceUnit", value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hourly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>,
        <Home className="h-4 w-4" />
      )}
      
      {renderFilterSection(
        "Amenities",
        "amenities",
        <div className="space-y-2">
          {SPACE_AMENITIES.map((amenity) => (
            <div key={amenity.value} className="flex items-center space-x-2">
              <Checkbox
                id={amenity.value}
                checked={(localFilters.amenities || []).includes(amenity.value)}
                onCheckedChange={(checked) => {
                  const currentAmenities = localFilters.amenities || [];
                  if (checked) {
                    updateFilter("amenities", [...currentAmenities, amenity.value]);
                  } else {
                    updateFilter("amenities", currentAmenities.filter(a => a !== amenity.value));
                  }
                }}
              />
              <Label
                htmlFor={amenity.value}
                className="text-sm font-normal cursor-pointer flex items-center gap-2"
              >
                <amenity.icon className="h-3 w-3" />
                {amenity.label}
              </Label>
            </div>
          ))}
        </div>,
        <Package className="h-4 w-4" />
      )}
    </>
  );

  // Thing-specific filters
  const renderThingFilters = () => (
    <>
      {renderFilterSection(
        "Condition",
        "condition",
        <RadioGroup
          value={localFilters.condition || "all"}
          onValueChange={(value) => updateFilter("condition", value === "all" ? undefined : value)}
        >
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="condition-all" />
              <Label htmlFor="condition-all">All Conditions</Label>
            </div>
            {THING_CONDITIONS.map((condition) => (
              <div key={condition.value} className="flex items-center space-x-2">
                <RadioGroupItem value={condition.value} id={`condition-${condition.value}`} />
                <Label htmlFor={`condition-${condition.value}`} className="cursor-pointer">
                  <div>
                    <div className="font-medium">{condition.label}</div>
                    <div className="text-xs text-muted-foreground">{condition.description}</div>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>,
        <Package className="h-4 w-4" />
      )}
      
      {renderFilterSection(
        "Purchase Options",
        "purchase",
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="negotiable" className="text-sm">Price Negotiable</Label>
            <Switch
              id="negotiable"
              checked={localFilters.isNegotiable || false}
              onCheckedChange={(checked) => updateFilter("isNegotiable", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="shipping" className="text-sm">Shipping Available</Label>
            <Switch
              id="shipping"
              checked={localFilters.shippingAvailable || false}
              onCheckedChange={(checked) => updateFilter("shippingAvailable", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="local-pickup" className="text-sm">Local Pickup Only</Label>
            <Switch
              id="local-pickup"
              checked={localFilters.localPickupOnly || false}
              onCheckedChange={(checked) => updateFilter("localPickupOnly", checked)}
            />
          </div>
        </div>,
        <Tag className="h-4 w-4" />
      )}
    </>
  );

  // Mobile filter sheet
  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 20 }}
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-80 bg-background border-r shadow-lg overflow-y-auto",
            className
          )}
        >
          <div className="sticky top-0 z-10 bg-background border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters</h2>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount} active</Badge>
                )}
                <Button size="icon" variant="ghost" onClick={handleReset}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {renderPriceFilter()}
            {renderRatingFilter()}
            
            {vertical === "services" && renderServiceFilters()}
            {vertical === "events" && renderEventFilters()}
            {vertical === "spaces" && renderSpaceFilters()}
            {vertical === "things" && renderThingFilters()}
          </div>

          <div className="sticky bottom-0 bg-background border-t p-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Reset
              </Button>
              <Button onClick={handleApply} className="flex-1">
                Apply Filters
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Desktop filter sidebar
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </h3>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeFilterCount} active
          </Badge>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        {/* Common filters */}
        {renderPriceFilter()}
        {renderRatingFilter()}
        
        <Separator />
        
        {/* Vertical-specific filters */}
        {vertical === "services" && renderServiceFilters()}
        {vertical === "events" && renderEventFilters()}
        {vertical === "spaces" && renderSpaceFilters()}
        {vertical === "things" && renderThingFilters()}
        
        {/* Show all vertical filters if "all" is selected */}
        {vertical === "all" && (
          <>
            <div className="text-sm font-medium text-muted-foreground">Service Filters</div>
            {renderServiceFilters()}
            <Separator />
            <div className="text-sm font-medium text-muted-foreground">Event Filters</div>
            {renderEventFilters()}
            <Separator />
            <div className="text-sm font-medium text-muted-foreground">Space Filters</div>
            {renderSpaceFilters()}
            <Separator />
            <div className="text-sm font-medium text-muted-foreground">Thing Filters</div>
            {renderThingFilters()}
          </>
        )}
      </div>

      <div className="sticky bottom-0 bg-background pt-4 flex gap-2">
        <Button variant="outline" onClick={handleReset} className="flex-1">
          Reset
        </Button>
        <Button onClick={handleApply} className="flex-1">
          Apply
        </Button>
      </div>
    </div>
  );
}