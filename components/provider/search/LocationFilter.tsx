"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface LocationFilterProps {
  city: string;
  state: string;
  zipCode: string;
  radius: number;
  onLocationChange: (location: {
    city?: string;
    state?: string;
    zipCode?: string;
    radius?: number;
    coordinates?: { lat: number; lng: number };
  }) => void;
  className?: string;
}

// US States for dropdown
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export function LocationFilter({
  city,
  state,
  zipCode,
  radius,
  onLocationChange,
  className,
}: LocationFilterProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Here you would typically reverse geocode to get city/state
          // For now, we'll just pass the coordinates
          onLocationChange({
            city,
            state,
            zipCode,
            radius,
            coordinates: { lat: latitude, lng: longitude },
          });
          
          // You could make an API call here to reverse geocode:
          // const response = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          // const data = await response.json();
          // onLocationChange({ city: data.city, state: data.state, ... });
          
          setIsGettingLocation(false);
        } catch (error) {
          setLocationError("Failed to get location details");
          setIsGettingLocation(false);
        }
      },
      (error) => {
        let errorMessage = "Failed to get your location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  const handleCityChange = (value: string) => {
    onLocationChange({ city: value, state, zipCode, radius });
  };

  const handleStateChange = (value: string) => {
    onLocationChange({ city, state: value, zipCode, radius });
  };

  const handleZipCodeChange = (value: string) => {
    // Only allow numbers and limit to 5 digits
    const cleanedValue = value.replace(/\D/g, "").slice(0, 5);
    onLocationChange({ city, state, zipCode: cleanedValue, radius });
  };

  const handleRadiusChange = (value: number[]) => {
    onLocationChange({ city, state, zipCode, radius: value[0] });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Current Location Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGetCurrentLocation}
        disabled={isGettingLocation}
      >
        {isGettingLocation ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Getting location...
          </>
        ) : (
          <>
            <Navigation className="mr-2 h-4 w-4" />
            Use Current Location
          </>
        )}
      </Button>

      {locationError && (
        <p className="text-sm text-destructive">{locationError}</p>
      )}

      <div className="relative">
        <Label htmlFor="city" className="text-sm">
          City
        </Label>
        <div className="relative mt-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="city"
            placeholder="Enter city"
            value={city}
            onChange={(e) => handleCityChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="state" className="text-sm">
          State
        </Label>
        <Select value={state} onValueChange={handleStateChange}>
          <SelectTrigger id="state" className="mt-1">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All States</SelectItem>
            {US_STATES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="zipCode" className="text-sm">
          ZIP Code
        </Label>
        <Input
          id="zipCode"
          placeholder="Enter ZIP"
          value={zipCode}
          onChange={(e) => handleZipCodeChange(e.target.value)}
          className="mt-1"
          maxLength={5}
          inputMode="numeric"
          pattern="[0-9]*"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Search Radius</Label>
          <span className="text-sm font-medium">
            {radius === 100 ? "100+ miles" : `${radius} miles`}
          </span>
        </div>
        <Slider
          value={[radius]}
          onValueChange={handleRadiusChange}
          min={5}
          max={100}
          step={5}
          className="mt-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>5 mi</span>
          <span>25 mi</span>
          <span>50 mi</span>
          <span>100+ mi</span>
        </div>
      </div>
    </div>
  );
}