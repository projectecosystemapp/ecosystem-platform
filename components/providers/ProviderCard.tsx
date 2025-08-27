'use client';

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Clock, DollarSign, CheckCircle2, Calendar } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Provider } from "@/types/api/providers";

interface ProviderCardProps {
  provider: Provider;
  onBook?: (providerId: string) => void;
  className?: string;
}

export function ProviderCard({ provider, onBook, className }: ProviderCardProps) {
  const initials = provider.displayName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className={`hover:shadow-lg transition-all hover:scale-[1.02] ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage 
                src={provider.profileImageUrl || undefined} 
                alt={provider.displayName} 
              />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {provider.displayName}
                {provider.isVerified && (
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                )}
              </h3>
              {provider.tagline && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {provider.tagline}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {provider.coverImageUrl && (
        <div className="relative h-32 mx-4">
          <Image
            src={provider.coverImageUrl}
            alt={`${provider.displayName} cover`}
            fill
            className="object-cover rounded-md"
          />
        </div>
      )}

      <CardContent className="space-y-4">
        {/* Rating and Reviews */}
        {provider.averageRating > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="ml-1 font-medium">{provider.averageRating.toFixed(1)}</span>
            </div>
            <span className="text-muted-foreground text-sm">
              ({provider.totalReviews} reviews)
            </span>
          </div>
        )}

        {/* Location */}
        {(provider.locationCity || provider.locationState) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>
              {[provider.locationCity, provider.locationState]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}

        {/* Services */}
        {provider.services && provider.services.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {provider.services.slice(0, 3).map((service, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {typeof service === 'string' ? service : service.name}
              </Badge>
            ))}
            {provider.services.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{provider.services.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Experience */}
        {provider.yearsExperience && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{provider.yearsExperience} years experience</span>
          </div>
        )}

        {/* Pricing */}
        {provider.hourlyRate && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-medium">
                ${provider.hourlyRate}/hour
              </span>
            </div>
            {provider.stripeOnboardingComplete ? (
              <Badge className="bg-green-100 text-green-800">Available</Badge>
            ) : (
              <Badge variant="secondary">Setup Pending</Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4 space-x-2">
        <Button asChild className="flex-1">
          <Link href={`/providers/${provider.slug}`}>
            View Profile
          </Link>
        </Button>
        {provider.stripeOnboardingComplete && onBook && (
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => onBook(provider.id)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Book Now
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}