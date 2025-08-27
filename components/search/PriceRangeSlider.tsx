"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";

// Types
export interface PriceRange {
  min: number;
  max: number;
}

export interface PriceRangeSliderProps {
  value?: PriceRange;
  onChange?: (range: PriceRange) => void;
  min?: number;
  max?: number;
  step?: number;
  currency?: string;
  currencySymbol?: string;
  showHistogram?: boolean;
  histogramData?: Array<{ price: number; count: number }>;
  presets?: Array<{ label: string; range: PriceRange }>;
  formatPrice?: (price: number) => string;
  className?: string;
  showInputs?: boolean;
  title?: string;
  description?: string;
}

// Default presets
const DEFAULT_PRESETS = [
  { label: "Under $50", range: { min: 0, max: 50 } },
  { label: "$50 - $100", range: { min: 50, max: 100 } },
  { label: "$100 - $250", range: { min: 100, max: 250 } },
  { label: "$250 - $500", range: { min: 250, max: 500 } },
  { label: "Over $500", range: { min: 500, max: 10000 } },
];

export function PriceRangeSlider({
  value,
  onChange,
  min = 0,
  max = 1000,
  step = 10,
  currency = "USD",
  currencySymbol = "$",
  showHistogram = false,
  histogramData,
  presets = DEFAULT_PRESETS,
  formatPrice,
  className,
  showInputs = true,
  title = "Price Range",
  description = "Set your price range",
}: PriceRangeSliderProps) {
  // State
  const [range, setRange] = useState<PriceRange>(
    value || { min, max }
  );
  const [inputMin, setInputMin] = useState(range.min.toString());
  const [inputMax, setInputMax] = useState(range.max.toString());
  const [isDragging, setIsDragging] = useState(false);

  // Update local state when value prop changes
  useEffect(() => {
    if (value) {
      setRange(value);
      setInputMin(value.min.toString());
      setInputMax(value.max.toString());
    }
  }, [value]);

  // Format price for display
  const defaultFormatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }, [currency]);

  const formatPriceDisplay = formatPrice || defaultFormatPrice;

  // Handle slider change
  const handleSliderChange = (values: number[]) => {
    const newRange = {
      min: Math.min(values[0], values[1]),
      max: Math.max(values[0], values[1]),
    };
    setRange(newRange);
    setInputMin(newRange.min.toString());
    setInputMax(newRange.max.toString());
    if (onChange) {
      onChange(newRange);
    }
  };

  // Handle input change
  const handleInputChange = (type: "min" | "max", value: string) => {
    if (type === "min") {
      setInputMin(value);
    } else {
      setInputMax(value);
    }
  };

  // Handle input blur (commit change)
  const handleInputBlur = (type: "min" | "max") => {
    const numValue = type === "min" 
      ? parseFloat(inputMin) || min
      : parseFloat(inputMax) || max;

    const clampedValue = Math.max(min, Math.min(max, numValue));
    
    const newRange = {
      ...range,
      [type]: clampedValue,
    };

    // Ensure min doesn't exceed max
    if (newRange.min > newRange.max) {
      if (type === "min") {
        newRange.min = newRange.max;
      } else {
        newRange.max = newRange.min;
      }
    }

    setRange(newRange);
    setInputMin(newRange.min.toString());
    setInputMax(newRange.max.toString());
    
    if (onChange) {
      onChange(newRange);
    }
  };

  // Handle preset click
  const handlePresetClick = (preset: { label: string; range: PriceRange }) => {
    setRange(preset.range);
    setInputMin(preset.range.min.toString());
    setInputMax(preset.range.max.toString());
    if (onChange) {
      onChange(preset.range);
    }
  };

  // Calculate percentage for positioning
  const getPercentage = (value: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  // Render histogram bars
  const renderHistogram = () => {
    if (!showHistogram || !histogramData || histogramData.length === 0) {
      return null;
    }

    const maxCount = Math.max(...histogramData.map(d => d.count));
    const bucketWidth = 100 / histogramData.length;

    return (
      <div className="absolute inset-0 flex items-end pointer-events-none">
        {histogramData.map((data, index) => {
          const height = (data.count / maxCount) * 100;
          const isInRange = data.price >= range.min && data.price <= range.max;
          
          return (
            <div
              key={index}
              className="relative"
              style={{ width: `${bucketWidth}%` }}
            >
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 transition-all duration-200",
                  isInRange ? "bg-blue-200 opacity-60" : "bg-gray-200 opacity-40"
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preset Buttons */}
          {presets.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset, index) => {
                  const isActive = 
                    range.min === preset.range.min && 
                    range.max === preset.range.max;
                  
                  return (
                    <Badge
                      key={index}
                      variant={isActive ? "default" : "outline"}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handlePresetClick(preset)}
                    >
                      {preset.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Slider Section */}
          <div className="space-y-4">
            <div className="relative">
              {/* Histogram Background */}
              <div className="relative h-12 mb-4">
                {renderHistogram()}
              </div>

              {/* Range Slider */}
              <div className="relative">
                <Slider
                  value={[range.min, range.max]}
                  onValueChange={handleSliderChange}
                  onPointerDown={() => setIsDragging(true)}
                  onPointerUp={() => setIsDragging(false)}
                  min={min}
                  max={max}
                  step={step}
                  className="w-full"
                />
                
                {/* Range Highlight */}
                <div
                  className="absolute h-1 bg-blue-500 pointer-events-none top-[10px]"
                  style={{
                    left: `${getPercentage(range.min)}%`,
                    width: `${getPercentage(range.max) - getPercentage(range.min)}%`,
                  }}
                />

                {/* Value Labels */}
                <motion.div
                  animate={{ scale: isDragging ? 1.1 : 1 }}
                  className="absolute -top-8 transform -translate-x-1/2 pointer-events-none"
                  style={{ left: `${getPercentage(range.min)}%` }}
                >
                  <Badge variant="secondary" className="text-xs">
                    {formatPriceDisplay(range.min)}
                  </Badge>
                </motion.div>

                <motion.div
                  animate={{ scale: isDragging ? 1.1 : 1 }}
                  className="absolute -top-8 transform -translate-x-1/2 pointer-events-none"
                  style={{ left: `${getPercentage(range.max)}%` }}
                >
                  <Badge variant="secondary" className="text-xs">
                    {formatPriceDisplay(range.max)}
                  </Badge>
                </motion.div>
              </div>

              {/* Min/Max Labels */}
              <div className="flex justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {formatPriceDisplay(min)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatPriceDisplay(max)}
                </span>
              </div>
            </div>
          </div>

          {/* Input Fields */}
          {showInputs && (
            <div className="space-y-2">
              <Label className="text-sm">Custom Range</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {currencySymbol}
                    </span>
                    <Input
                      type="number"
                      value={inputMin}
                      onChange={(e) => handleInputChange("min", e.target.value)}
                      onBlur={() => handleInputBlur("min")}
                      min={min}
                      max={max}
                      step={step}
                      className="pl-8"
                      placeholder="Min"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Minimum</span>
                </div>
                
                <span className="text-muted-foreground">—</span>
                
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {currencySymbol}
                    </span>
                    <Input
                      type="number"
                      value={inputMax}
                      onChange={(e) => handleInputChange("max", e.target.value)}
                      onBlur={() => handleInputBlur("max")}
                      min={min}
                      max={max}
                      step={step}
                      className="pl-8"
                      placeholder="Max"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Maximum</span>
                </div>
              </div>
            </div>
          )}

          {/* Current Selection Summary */}
          <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Selected Range:</span>
              <Badge variant="default">
                {formatPriceDisplay(range.min)} - {formatPriceDisplay(range.max)}
              </Badge>
            </div>
            
            {histogramData && (
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {histogramData.filter(d => d.price >= range.min && d.price <= range.max).length} items in this range
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Additional Info */}
          {showHistogram && histogramData && (
            <div className="text-xs text-muted-foreground text-center">
              Price distribution based on {histogramData.length} listings
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}