"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, 
  Search, 
  Navigation, 
  X,
  Loader2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { useDebouncedCallback } from "use-debounce";

// Types
export interface Location {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface LocationPickerProps {
  value?: Location & { radius?: number };
  onChange?: (location: Location & { radius: number }) => void;
  showMap?: boolean;
  showRadius?: boolean;
  defaultRadius?: number;
  placeholder?: string;
  className?: string;
  mapHeight?: string;
  googleMapsApiKey?: string;
}

// Radius options in miles
const RADIUS_OPTIONS = [
  { value: 1, label: "1 mile" },
  { value: 5, label: "5 miles" },
  { value: 10, label: "10 miles" },
  { value: 25, label: "25 miles" },
  { value: 50, label: "50 miles" },
  { value: 100, label: "100 miles" },
];

// Recent locations storage key
const RECENT_LOCATIONS_KEY = "recentLocations";
const MAX_RECENT_LOCATIONS = 5;

export function LocationPicker({
  value,
  onChange,
  showMap = true,
  showRadius = true,
  defaultRadius = 10,
  placeholder = "Enter location or address",
  className,
  mapHeight = "h-64",
  googleMapsApiKey,
}: LocationPickerProps) {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [location, setLocation] = useState<Location | undefined>(value);
  const [radius, setRadius] = useState(value?.radius || defaultRadius);
  const [searchQuery, setSearchQuery] = useState(value?.address || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [recentLocations, setRecentLocations] = useState<Location[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load recent locations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_LOCATIONS_KEY);
    if (stored) {
      try {
        setRecentLocations(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse recent locations:", e);
      }
    }
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    if (!showMap || mapLoaded) return;

    const loadGoogleMaps = () => {
      if (!window.google) {
        // Load Google Maps script
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initializeMap;
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (!mapRef.current) return;

      // Initialize map
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: location || { lat: 40.7128, lng: -74.0060 }, // Default to NYC
        zoom: 12,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Initialize geocoder
      geocoderRef.current = new google.maps.Geocoder();

      // Initialize marker
      markerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        draggable: true,
        animation: google.maps.Animation.DROP,
      });

      // Initialize radius circle
      if (showRadius) {
        circleRef.current = new google.maps.Circle({
          map: mapInstanceRef.current,
          strokeColor: "#3B82F6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#3B82F6",
          fillOpacity: 0.15,
          editable: false,
        });
      }

      // Handle marker drag
      markerRef.current.addListener("dragend", () => {
        const position = markerRef.current?.getPosition();
        if (position) {
          reverseGeocode(position.lat(), position.lng());
        }
      });

      // Handle map click
      mapInstanceRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          updateMapLocation(e.latLng.lat(), e.latLng.lng());
          reverseGeocode(e.latLng.lat(), e.latLng.lng());
        }
      });

      setMapLoaded(true);
    };

    loadGoogleMaps();
  }, [showMap, googleMapsApiKey, location, showRadius, mapLoaded]);

  // Initialize Places Autocomplete
  useEffect(() => {
    if (!inputRef.current || !window.google || autocompleteRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode"],
      fields: ["formatted_address", "geometry", "address_components"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        const newLocation: Location = {
          lat,
          lng,
          address: place.formatted_address || "",
        };

        // Extract city, state, etc. from address components
        if (place.address_components) {
          place.address_components.forEach((component) => {
            if (component.types.includes("locality")) {
              newLocation.city = component.long_name;
            }
            if (component.types.includes("administrative_area_level_1")) {
              newLocation.state = component.short_name;
            }
            if (component.types.includes("postal_code")) {
              newLocation.zipCode = component.long_name;
            }
            if (component.types.includes("country")) {
              newLocation.country = component.short_name;
            }
          });
        }

        handleLocationSelect(newLocation);
      }
    });
  }, [mapLoaded]);

  // Update map when location changes
  useEffect(() => {
    if (!mapInstanceRef.current || !location) return;

    updateMapLocation(location.lat, location.lng);
  }, [location]);

  // Update circle when radius changes
  useEffect(() => {
    if (!circleRef.current || !location) return;

    circleRef.current.setCenter({ lat: location.lat, lng: location.lng });
    circleRef.current.setRadius(radius * 1609.34); // Convert miles to meters
  }, [location, radius]);

  // Update map location
  const updateMapLocation = (lat: number, lng: number) => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    const position = { lat, lng };
    mapInstanceRef.current.setCenter(position);
    markerRef.current.setPosition(position);

    if (circleRef.current) {
      circleRef.current.setCenter(position);
      circleRef.current.setRadius(radius * 1609.34);
    }
  };

  // Reverse geocode coordinates
  const reverseGeocode = async (lat: number, lng: number) => {
    if (!geocoderRef.current) return;

    setIsLoading(true);
    try {
      const response = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoderRef.current!.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results) {
            resolve(results);
          } else {
            reject(new Error(status));
          }
        });
      });

      if (response[0]) {
        const place = response[0];
        const newLocation: Location = {
          lat,
          lng,
          address: place.formatted_address,
        };

        // Extract components
        place.address_components.forEach((component) => {
          if (component.types.includes("locality")) {
            newLocation.city = component.long_name;
          }
          if (component.types.includes("administrative_area_level_1")) {
            newLocation.state = component.short_name;
          }
          if (component.types.includes("postal_code")) {
            newLocation.zipCode = component.long_name;
          }
          if (component.types.includes("country")) {
            newLocation.country = component.short_name;
          }
        });

        handleLocationSelect(newLocation);
        setSearchQuery(place.formatted_address);
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      toast({
        title: "Error",
        description: "Failed to get address for this location",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle location selection
  const handleLocationSelect = (newLocation: Location) => {
    setLocation(newLocation);
    setSearchQuery(newLocation.address);
    setShowSuggestions(false);

    // Save to recent locations
    const updatedRecent = [
      newLocation,
      ...recentLocations.filter(l => l.address !== newLocation.address).slice(0, MAX_RECENT_LOCATIONS - 1),
    ];
    setRecentLocations(updatedRecent);
    localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updatedRecent));

    // Call onChange
    if (onChange) {
      onChange({ ...newLocation, radius });
    }
  };

  // Get current location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        reverseGeocode(position.coords.latitude, position.coords.longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          title: "Location error",
          description: "Unable to get your current location",
          variant: "destructive",
        });
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (query.length < 3 || !geocoderRef.current) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoderRef.current!.geocode({ address: query }, (results, status) => {
          if (status === "OK" && results) {
            resolve(results);
          } else {
            reject(new Error(status));
          }
        });
      });

      setSuggestions(response.slice(0, 5));
    } catch (error) {
      console.error("Geocoding error:", error);
      setSuggestions([]);
    }
  }, 300);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    debouncedSearch(value);
  };

  // Handle radius change
  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (onChange && location) {
      onChange({ ...location, radius: newRadius });
    }
  };

  // Clear location
  const handleClear = () => {
    setLocation(undefined);
    setSearchQuery("");
    setSuggestions([]);
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    if (circleRef.current) {
      circleRef.current.setMap(null);
    }
    if (onChange) {
      onChange(undefined as any);
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location
        </CardTitle>
        <CardDescription>
          Search for a location or use your current position
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder={placeholder}
              className="pl-10 pr-20"
            />
            {searchQuery && (
              <button
                onClick={handleClear}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Suggestions Dropdown */}
          <AnimatePresence>
            {showSuggestions && (suggestions.length > 0 || recentLocations.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
              >
                {suggestions.length > 0 && (
                  <div className="p-2">
                    <div className="text-xs font-medium text-muted-foreground px-2 pb-1">
                      Suggestions
                    </div>
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const location = suggestion.geometry.location;
                          handleLocationSelect({
                            lat: location.lat(),
                            lng: location.lng(),
                            address: suggestion.formatted_address,
                          });
                        }}
                        className="w-full text-left px-2 py-2 hover:bg-accent rounded text-sm"
                      >
                        {suggestion.formatted_address}
                      </button>
                    ))}
                  </div>
                )}

                {recentLocations.length > 0 && suggestions.length === 0 && (
                  <div className="p-2">
                    <div className="text-xs font-medium text-muted-foreground px-2 pb-1">
                      Recent Locations
                    </div>
                    {recentLocations.map((loc, index) => (
                      <button
                        key={index}
                        onClick={() => handleLocationSelect(loc)}
                        className="w-full text-left px-2 py-2 hover:bg-accent rounded text-sm flex items-center gap-2"
                      >
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <div className="flex-1">
                          <div>{loc.address}</div>
                          {loc.city && loc.state && (
                            <div className="text-xs text-muted-foreground">
                              {loc.city}, {loc.state}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Current Location Display */}
        {location && (
          <div className="p-3 bg-accent rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-sm">{location.address}</div>
                {location.city && location.state && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {location.city}, {location.state} {location.zipCode}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              </div>
              <Badge variant="secondary">Selected</Badge>
            </div>
          </div>
        )}

        {/* Radius Selector */}
        {showRadius && (
          <div className="space-y-2">
            <Label className="text-sm">Search Radius</Label>
            <div className="flex items-center gap-4">
              <Select
                value={radius.toString()}
                onValueChange={(value) => handleRadiusChange(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1">
                <Slider
                  value={[radius]}
                  onValueChange={([value]) => handleRadiusChange(value)}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              <span className="text-sm text-muted-foreground w-20 text-right">
                {radius} mi
              </span>
            </div>
          </div>
        )}

        {/* Map Display */}
        {showMap && (
          <div className="space-y-2">
            <Label className="text-sm">Map</Label>
            <div
              ref={mapRef}
              className={cn(
                "w-full rounded-lg border bg-muted",
                mapHeight,
                !mapLoaded && "flex items-center justify-center"
              )}
            >
              {!mapLoaded && (
                <div className="text-sm text-muted-foreground">
                  Loading map...
                </div>
              )}
            </div>
            {showMap && location && (
              <div className="text-xs text-muted-foreground">
                Click on the map or drag the marker to adjust location
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}