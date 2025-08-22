"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
  autoFocus?: boolean;
  showClearButton?: boolean;
  instantSearch?: boolean;
  debounceMs?: number;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search for providers, services...",
  className,
  isLoading = false,
  autoFocus = false,
  showClearButton = true,
  instantSearch = true,
  debounceMs = 300,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, debounceMs);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Handle debounced search for instant search
  useEffect(() => {
    if (instantSearch && debouncedValue !== value) {
      onChange(debouncedValue);
      onSearch();
    }
  }, [debouncedValue, instantSearch, value, onChange, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instantSearch) {
      onChange(localValue);
    }
    onSearch();
  };

  const handleClear = () => {
    setLocalValue("");
    onChange("");
    onSearch();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (!instantSearch) {
      onChange(newValue);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative">
        <Search 
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors",
            localValue && "text-primary"
          )} 
        />
        <Input
          type="search"
          placeholder={placeholder}
          value={localValue}
          onChange={handleChange}
          className={cn(
            "pl-10 pr-24 h-12 text-base transition-all",
            "focus:ring-2 focus:ring-primary/20",
            localValue && "pr-32"
          )}
          autoFocus={autoFocus}
          aria-label="Search providers"
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Clear button */}
          {showClearButton && localValue && !isLoading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="px-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {/* Search button for non-instant search */}
          {!instantSearch && (
            <Button 
              type="submit" 
              size="sm"
              disabled={isLoading}
              className="h-8"
            >
              Search
            </Button>
          )}
        </div>
      </div>
      
      {/* Search suggestions or recent searches could go here */}
    </form>
  );
}