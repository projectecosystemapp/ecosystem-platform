"use client";

import React, { useState } from "react";
import { 
  UniversalListingCard, 
  CardSkeletonGrid, 
  CardSkeletonList,
  type ListingData 
} from "@/components/marketplace/cards";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ToggleGroup, 
  ToggleGroupItem 
} from "@/components/ui/toggle-group";
import { Grid3x3, List } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Sample data for demonstration
const sampleListings: ListingData[] = [
  // Service listings
  {
    id: "service-1",
    type: "service",
    title: "Professional Home Cleaning Service",
    description: "Experienced cleaner offering thorough home cleaning services with eco-friendly products. Attention to detail guaranteed.",
    thumbnailUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop",
    images: ["https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=600&fit=crop"],
    location: {
      address: "Downtown",
      city: "San Francisco",
      distance: 2.5,
      coordinates: { lat: 37.7749, lng: -122.4194 }
    },
    price: 50,
    priceUnit: "hour",
    currency: "USD",
    provider: {
      id: "provider-1",
      name: "Sarah Johnson",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      verified: true,
      rating: 4.8,
      reviewCount: 127
    },
    duration: 120,
    instantBooking: true,
    availability: "available",
    categories: ["Home", "Cleaning", "Professional"],
    stats: {
      views: 342,
      favorites: 28,
      bookings: 15
    },
    featured: true,
    createdAt: new Date("2024-01-15")
  },
  {
    id: "service-2",
    type: "service",
    title: "Personal Fitness Training",
    description: "Certified personal trainer specializing in weight loss and muscle building. Custom workout plans included.",
    thumbnailUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
    location: {
      city: "Oakland",
      distance: 5.2
    },
    price: { min: 60, max: 100 },
    priceUnit: "session",
    provider: {
      id: "provider-2",
      name: "Mike Chen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      verified: false,
      rating: 4.9,
      reviewCount: 89
    },
    duration: 60,
    availability: "busy",
    nextAvailable: new Date(Date.now() + 86400000), // Tomorrow
    categories: ["Fitness", "Health", "Training"],
    stats: {
      views: 567,
      favorites: 45
    }
  },

  // Event listings
  {
    id: "event-1",
    type: "event",
    title: "Yoga & Mindfulness Workshop",
    description: "Join us for a transformative morning of yoga and meditation. All levels welcome. Mats provided.",
    thumbnailUrl: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=300&fit=crop",
    location: {
      address: "Golden Gate Park",
      city: "San Francisco",
      distance: 3.1
    },
    price: 35,
    currency: "USD",
    provider: {
      id: "provider-3",
      name: "Wellness Studio SF",
      avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop"
    },
    startDate: new Date(Date.now() + 172800000), // In 2 days
    endDate: new Date(Date.now() + 180000000),
    eventType: "Workshop",
    capacity: 30,
    attendees: 24,
    spotsLeft: 6,
    isOnline: false,
    tags: ["Yoga", "Meditation", "Wellness", "Mindfulness"],
    stats: {
      views: 892,
      favorites: 67
    },
    boosted: true
  },
  {
    id: "event-2",
    type: "event",
    title: "Tech Talk: AI in Healthcare",
    description: "Industry experts discuss the latest developments in AI applications for healthcare.",
    thumbnailUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop",
    location: {
      city: "Online"
    },
    price: 0,
    provider: {
      id: "provider-4",
      name: "TechHub",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
    },
    startDate: new Date(Date.now() + 604800000), // In 1 week
    eventType: "Webinar",
    capacity: 500,
    attendees: 127,
    isOnline: true,
    tags: ["Technology", "AI", "Healthcare"],
    stats: {
      views: 1453,
      favorites: 89
    }
  },

  // Space listings
  {
    id: "space-1",
    type: "space",
    title: "Modern Conference Room",
    description: "Fully equipped conference room with AV equipment, whiteboard, and high-speed internet. Perfect for meetings up to 12 people.",
    thumbnailUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
    location: {
      address: "Financial District",
      city: "San Francisco",
      distance: 1.2
    },
    price: 75,
    priceUnit: "hour",
    currency: "USD",
    provider: {
      id: "provider-5",
      name: "WorkSpace Plus",
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop",
      rating: 4.7,
      reviewCount: 43
    },
    size: 450,
    sizeUnit: "sqft",
    capacity: 12,
    amenities: ["WiFi", "Projector", "Whiteboard", "Coffee", "Air Conditioning", "Parking"],
    availableNow: true,
    minRentalPeriod: 2,
    rentalUnit: "hour",
    stats: {
      views: 234,
      bookings: 8
    }
  },
  {
    id: "space-2",
    type: "space",
    title: "Creative Studio Space",
    description: "Bright, open studio perfect for photoshoots, workshops, or creative projects. Natural light throughout.",
    thumbnailUrl: "https://images.unsplash.com/photo-1524634126442-357e0eac3c14?w=400&h=300&fit=crop",
    location: {
      city: "Berkeley",
      distance: 8.5
    },
    price: { min: 100, max: 200 },
    priceUnit: "day",
    provider: {
      id: "provider-6",
      name: "ArtSpace Collective",
      rating: 4.9,
      reviewCount: 67
    },
    size: 1200,
    sizeUnit: "sqft",
    capacity: 25,
    amenities: ["Natural Light", "Kitchen", "Bathroom", "Props", "Changing Room"],
    availableNow: false,
    featured: true
  },

  // Thing listings
  {
    id: "thing-1",
    type: "thing",
    title: "MacBook Pro 16\" M2 Max",
    description: "Like new condition, barely used. Comes with original box, charger, and AppleCare+ until 2025.",
    thumbnailUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop",
    location: {
      city: "Palo Alto",
      distance: 15.3
    },
    price: 2800,
    currency: "USD",
    provider: {
      id: "provider-7",
      name: "John Smith",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      rating: 5.0,
      reviewCount: 12
    },
    condition: "like_new",
    brand: "Apple",
    model: "MacBook Pro 16\"",
    year: 2023,
    negotiable: true,
    shippingAvailable: true,
    localPickupOnly: false,
    category: "Electronics",
    subcategory: "Computers",
    createdAt: new Date(Date.now() - 86400000), // Yesterday
    stats: {
      views: 156,
      favorites: 23
    }
  },
  {
    id: "thing-2",
    type: "thing",
    title: "Vintage Leather Armchair",
    description: "Beautiful mid-century modern armchair in excellent condition. Rich brown leather with minor patina adds character.",
    thumbnailUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop",
    location: {
      city: "San Mateo",
      distance: 12.7
    },
    price: 450,
    provider: {
      id: "provider-8",
      name: "Vintage Finds",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop"
    },
    condition: "good",
    negotiable: false,
    shippingAvailable: false,
    localPickupOnly: true,
    category: "Furniture",
    createdAt: new Date(Date.now() - 604800000), // 1 week ago
    stats: {
      views: 89
    }
  },
  {
    id: "thing-3",
    type: "thing",
    title: "Professional Camera Equipment Bundle",
    description: "Canon 5D Mark IV with multiple lenses, tripod, and accessories. Perfect for professional photography.",
    thumbnailUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=300&fit=crop",
    location: {
      city: "Redwood City",
      distance: 18.2
    },
    price: { min: 3000, max: 3500 },
    provider: {
      id: "provider-9",
      name: "PhotoPro Store",
      rating: 4.6,
      reviewCount: 34
    },
    condition: "excellent",
    brand: "Canon",
    negotiable: true,
    shippingAvailable: true,
    sold: true, // Example of sold item
    category: "Electronics",
    subcategory: "Cameras",
    createdAt: new Date(Date.now() - 259200000) // 3 days ago
  }
];

export default function MarketplaceDemoPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  const { toast } = useToast();

  // Filter listings by type
  const getFilteredListings = () => {
    if (selectedTab === "all") return sampleListings;
    return sampleListings.filter(listing => listing.type === selectedTab);
  };

  // Handle card actions
  const handleCardClick = (listing: ListingData) => {
    toast({
      title: "Card Clicked",
      description: `Clicked on: ${listing.title}`,
    });
  };

  const handleFavorite = async (listing: ListingData, isFavorited: boolean) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`${isFavorited ? "Added" : "Removed"} favorite:`, listing.id);
  };

  const handleShare = (listing: ListingData) => {
    toast({
      title: "Shared",
      description: `Link copied for: ${listing.title}`,
    });
  };

  const handleBook = (listing: ListingData) => {
    toast({
      title: "Booking",
      description: `Opening booking modal for: ${listing.title}`,
    });
  };

  // Simulate loading
  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Universal Listing Card Demo
          </h1>
          <p className="text-gray-600">
            Showcase of the polymorphic card system supporting all marketplace verticals
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Category Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="service">Services</TabsTrigger>
                <TabsTrigger value="event">Events</TabsTrigger>
                <TabsTrigger value="space">Spaces</TabsTrigger>
                <TabsTrigger value="thing">Things</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={simulateLoading}
              >
                Simulate Loading
              </Button>
              
              <ToggleGroup 
                type="single" 
                value={view} 
                onValueChange={(value) => value && setView(value as "grid" | "list")}
              >
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <Grid3x3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        {/* Listings */}
        {loading ? (
          view === "grid" ? (
            <CardSkeletonGrid columns={3} rows={2} type="service" />
          ) : (
            <CardSkeletonList count={4} type="service" />
          )
        ) : (
          <div 
            className={
              view === "grid" 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            }
          >
            {getFilteredListings().map((listing) => (
              <UniversalListingCard
                key={listing.id}
                listing={listing}
                view={view}
                onClick={handleCardClick}
                onFavorite={handleFavorite}
                onShare={handleShare}
                onBook={handleBook}
                showQuickActions={true}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && getFilteredListings().length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No listings found for this category</p>
          </div>
        )}
      </div>
    </div>
  );
}