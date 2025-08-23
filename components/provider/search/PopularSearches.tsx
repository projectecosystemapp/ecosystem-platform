"use client";

import { useRouter } from "next/navigation";

export function PopularSearches() {
  const router = useRouter();
  
  const handleSearch = (query: string) => {
    router.push(`/providers?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-6">
      <span className="text-sm text-muted-foreground">Popular searches:</span>
      <button 
        onClick={() => handleSearch("Photography")}
        className="text-sm text-primary hover:underline transition-colors"
      >
        Photography
      </button>
      <span className="text-muted-foreground">•</span>
      <button 
        onClick={() => handleSearch("Personal Training")}
        className="text-sm text-primary hover:underline transition-colors"
      >
        Personal Training
      </button>
      <span className="text-muted-foreground">•</span>
      <button 
        onClick={() => handleSearch("Home Cleaning")}
        className="text-sm text-primary hover:underline transition-colors"
      >
        Home Cleaning
      </button>
      <span className="text-muted-foreground">•</span>
      <button 
        onClick={() => handleSearch("Tutoring")}
        className="text-sm text-primary hover:underline transition-colors"
      >
        Tutoring
      </button>
    </div>
  );
}