"use client";

import { Grid3X3, List, Map } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list" | "map";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
  showMapOption?: boolean;
  disabled?: boolean;
}

export function ViewToggle({
  value,
  onChange,
  className,
  showMapOption = false,
  disabled = false,
}: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onChange(newValue as ViewMode);
      }}
      className={cn("border rounded-md p-1", className)}
      disabled={disabled}
    >
      <ToggleGroupItem 
        value="grid" 
        aria-label="Grid view"
        className="px-3"
      >
        <Grid3X3 className="h-4 w-4" />
        <span className="ml-2 hidden sm:inline">Grid</span>
      </ToggleGroupItem>
      
      <ToggleGroupItem 
        value="list" 
        aria-label="List view"
        className="px-3"
      >
        <List className="h-4 w-4" />
        <span className="ml-2 hidden sm:inline">List</span>
      </ToggleGroupItem>
      
      {showMapOption && (
        <ToggleGroupItem 
          value="map" 
          aria-label="Map view"
          className="px-3"
        >
          <Map className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Map</span>
        </ToggleGroupItem>
      )}
    </ToggleGroup>
  );
}