// Server Component version of ProviderCard - optimized for RSC
import Link from "next/link";
import Image from "next/image";
import { 
  Star, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Shield,
  Calendar,
  Users,
  MessageCircle
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Provider } from "@/db/schema/providers-schema";
import { FavoriteButton } from "./FavoriteButton";

interface ExtendedProvider extends Provider {
  instantBooking?: boolean;
  totalBookings?: number;
  hasInsurance?: boolean;
  responseTime?: string;
}

interface ProviderCardProps {
  provider: ExtendedProvider;
  viewMode?: "grid" | "list" | "map";
  showFavorite?: boolean;
  isFavorited?: boolean;
  className?: string;
}

export function ProviderCardServer({
  provider,
  viewMode = "grid",
  showFavorite = true,
  isFavorited = false,
  className,
}: ProviderCardProps) {
  const initials = provider.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Format the rating display
  const rating = provider.averageRating ? Number(provider.averageRating) : 0;
  const reviewCount = provider.totalReviews || 0;

  if (viewMode === "list") {
    return (
      <Card 
        className={cn(
          "overflow-hidden hover:shadow-lg transition-all duration-200",
          "hover:scale-[1.01]",
          className
        )}
      >
        <Link href={`/providers/${provider.slug}`} className="block">
          <div className="flex flex-col sm:flex-row">
            {/* Image Section */}
            <div className="relative w-full sm:w-48 h-48 sm:h-auto">
              {provider.profileImageUrl ? (
                <Image
                  src={provider.profileImageUrl}
                  alt={provider.displayName}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 192px"
                  priority={false}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary/50" aria-hidden="true">
                    {initials}
                  </span>
                </div>
              )}
              
              {/* Badges */}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {provider.isVerified && (
                  <Badge className="bg-blue-500 text-white border-0">
                    <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                    <span className="sr-only">Verified provider</span>
                    Verified
                  </Badge>
                )}
                {provider.instantBooking && (
                  <Badge className="bg-green-500 text-white border-0">
                    <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
                    <span className="sr-only">Instant booking available</span>
                    Instant
                  </Badge>
                )}
              </div>

              {/* Favorite Button - Client Component */}
              {showFavorite && (
                <FavoriteButton 
                  providerId={provider.id}
                  isFavorited={isFavorited}
                  className="absolute top-2 right-2"
                />
              )}
            </div>

            {/* Content Section */}
            <div className="flex-1 p-6">
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold line-clamp-1">
                        {provider.displayName}
                      </h3>
                      {provider.tagline && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {provider.tagline}
                        </p>
                      )}
                    </div>
                    {provider.hourlyRate && (
                      <div className="text-right ml-4">
                        <div className="text-lg font-semibold">
                          ${provider.hourlyRate}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          per hour
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Location & Stats */}
                  <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
                    {(provider.locationCity || provider.locationState) && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        <span>
                          {provider.locationCity}
                          {provider.locationCity && provider.locationState && ", "}
                          {provider.locationState}
                        </span>
                      </div>
                    )}
                    
                    {rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                        <span className="font-medium">{rating.toFixed(1)}</span>
                        <span className="text-muted-foreground">
                          ({reviewCount} <span className="sr-only">reviews</span>)
                        </span>
                      </div>
                    )}
                    
                    {provider.yearsExperience && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <span>{provider.yearsExperience}y <span className="sr-only">years</span> exp</span>
                      </div>
                    )}

                    {provider.totalBookings && provider.totalBookings > 10 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        <span>{provider.totalBookings}+ bookings</span>
                      </div>
                    )}
                  </div>

                  {/* Services */}
                  {provider.services && provider.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {provider.services.slice(0, 5).map((service: any, index: number) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {service.name}
                        </Badge>
                      ))}
                      {provider.services.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.services.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Bio Preview */}
                  {provider.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {provider.bio}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center gap-2 mt-4">
                  <Button size="sm" className="flex-1 sm:flex-initial">
                    View Profile
                  </Button>
                  {provider.instantBooking && (
                    <Button size="sm" variant="outline">
                      Book Now
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      </Card>
    );
  }

  // Grid View (default)
  return (
    <Card 
      className={cn(
        "overflow-hidden hover:shadow-lg transition-all duration-200",
        "hover:scale-[1.02]",
        className
      )}
    >
      <Link href={`/providers/${provider.slug}`} className="block">
        {/* Image Section */}
        <div className="relative h-48 w-full">
          {provider.profileImageUrl ? (
            <Image
              src={provider.profileImageUrl}
              alt={provider.displayName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={false}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <span className="text-4xl font-bold text-primary/50" aria-hidden="true">
                {initials}
              </span>
            </div>
          )}
          
          {/* Overlay Badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            {provider.isVerified && (
              <Badge className="bg-blue-500 text-white border-0">
                <CheckCircle className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Verified</span>
              </Badge>
            )}
            {provider.hasInsurance && (
              <Badge className="bg-purple-500 text-white border-0">
                <Shield className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Insured</span>
              </Badge>
            )}
          </div>

          {/* Favorite Button - Client Component */}
          {showFavorite && (
            <FavoriteButton 
              providerId={provider.id}
              isFavorited={isFavorited}
              className="absolute top-2 right-2"
              showOnHover
            />
          )}

          {/* Price Badge */}
          {provider.hourlyRate && (
            <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1">
              <div className="text-sm font-semibold" aria-label={`${provider.hourlyRate} dollars per hour`}>
                ${provider.hourlyRate}/hr
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <h3 className="font-semibold line-clamp-1">
              {provider.displayName}
            </h3>
            {provider.tagline && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {provider.tagline}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {/* Location */}
          {(provider.locationCity || provider.locationState) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              <span className="line-clamp-1">
                {provider.locationCity}
                {provider.locationCity && provider.locationState && ", "}
                {provider.locationState}
              </span>
            </div>
          )}

          {/* Rating & Reviews */}
          {rating > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                <span className="font-medium text-sm">{rating.toFixed(1)}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                ({reviewCount} reviews)
              </span>
            </div>
          )}

          {/* Services */}
          {provider.services && provider.services.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {provider.services.slice(0, 2).map((service: any, index: number) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-xs"
                >
                  {service.name}
                </Badge>
              ))}
              {provider.services.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{provider.services.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {provider.yearsExperience && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>{provider.yearsExperience}y exp</span>
              </div>
            )}
            {provider.responseTime && (
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" aria-hidden="true" />
                <span>Fast reply</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <Button className="w-full" size="sm">
            View Profile
          </Button>
        </CardFooter>
      </Link>
    </Card>
  );
}