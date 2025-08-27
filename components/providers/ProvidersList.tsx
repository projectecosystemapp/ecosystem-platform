'use client';

import { Provider } from "@/types/api/providers";
import { ProviderCard } from "./ProviderCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

interface ProvidersListProps {
  providers: Provider[];
  isLoading?: boolean;
  columns?: 1 | 2 | 3 | 4;
  onProviderClick?: (provider: Provider) => void;
}

export function ProvidersList({ 
  providers, 
  isLoading = false,
  columns = 3,
  onProviderClick 
}: ProvidersListProps) {
  const router = useRouter();

  const handleBook = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      router.push(`/providers/${provider.slug}/book`);
    }
  };

  const handleProviderClick = (provider: Provider) => {
    if (onProviderClick) {
      onProviderClick(provider);
    } else {
      router.push(`/providers/${provider.slug}`);
    }
  };

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  if (isLoading) {
    return (
      <div className={`grid ${gridCols[columns]} gap-6`}>
        {[...Array(columns * 2)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardHeader>
            <Skeleton className="h-32 mx-4 mb-4" />
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No providers found</p>
      </div>
    );
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-6`}>
      {providers.map((provider) => (
        <div 
          key={provider.id}
          onClick={() => handleProviderClick(provider)}
          className="cursor-pointer"
        >
          <ProviderCard 
            provider={provider}
            onBook={handleBook}
          />
        </div>
      ))}
    </div>
  );
}

// Add the missing imports at the top
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";