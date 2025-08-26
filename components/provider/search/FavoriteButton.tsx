"use client";

import { useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FavoriteButtonProps {
  providerId: string;
  isFavorited: boolean;
  className?: string;
  showOnHover?: boolean;
  onToggle?: (providerId: string) => void;
}

export function FavoriteButton({ 
  providerId, 
  isFavorited: initialFavorited, 
  className,
  showOnHover = false,
  onToggle 
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleFavoriteClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Optimistic update
      const newState = !isFavorited;
      setIsFavorited(newState);
      
      // Call the toggle handler if provided
      if (onToggle) {
        onToggle(providerId);
      } else {
        // Otherwise make API call
        const response = await fetch(`/api/providers/${providerId}/favorite`, {
          method: newState ? "POST" : "DELETE",
        });
        
        if (!response.ok) {
          // Revert on failure
          setIsFavorited(!newState);
          throw new Error("Failed to update favorite");
        }
      }
      
      // Show feedback
      toast.success(newState ? "Added to favorites" : "Removed from favorites");
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorite");
    } finally {
      setIsLoading(false);
    }
  }, [providerId, isFavorited, isLoading, onToggle]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "bg-white/80 backdrop-blur-sm hover:bg-white transition-all",
        showOnHover && !isHovered && "opacity-0 sm:opacity-100",
        className
      )}
      onClick={handleFavoriteClick}
      disabled={isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorited}
    >
      <Heart 
        className={cn(
          "h-4 w-4 transition-colors",
          isFavorited && "fill-red-500 text-red-500",
          isLoading && "animate-pulse"
        )}
        aria-hidden="true"
      />
    </Button>
  );
}