"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Heart, 
  Package, 
  Calendar, 
  MapPin, 
  ShoppingBag,
  Star,
  Search,
  Trash2,
  ExternalLink,
  StickyNote,
  Grid,
  List,
  Users
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Favorite {
  id: string;
  type: string;
  name?: string;
  description?: string;
  image?: string | null;
  price?: string | number | null;
  rating?: number | null;
  category?: string;
  notes?: string | null;
  createdAt: Date;
  href: string;
  date?: Date;
  location?: string;
  capacity?: number;
  condition?: string;
}

interface FavoritesClientProps {
  favorites: Favorite[];
  stats: {
    total: number;
    providers: number;
    services: number;
    events: number;
    spaces: number;
    things: number;
  };
}

export function FavoritesClient({ favorites, stats }: FavoritesClientProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredFavorites = favorites.filter((fav) => {
    const matchesSearch = !searchQuery || 
      fav.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fav.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fav.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = activeTab === "all" || fav.type === activeTab;
    
    return matchesSearch && matchesType;
  });

  const removeFavorite = async (id: string) => {
    try {
      // In a real implementation, this would call an API to remove the favorite
      console.log("Removing favorite:", id);
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "provider":
        return <Users className="h-4 w-4" />;
      case "service":
        return <Package className="h-4 w-4" />;
      case "event":
        return <Calendar className="h-4 w-4" />;
      case "space":
        return <MapPin className="h-4 w-4" />;
      case "thing":
        return <ShoppingBag className="h-4 w-4" />;
      default:
        return <Heart className="h-4 w-4" />;
    }
  };

  const formatPrice = (price: string | number | null) => {
    if (!price) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof price === 'string' ? parseFloat(price) : price);
  };

  const FavoriteCard = ({ favorite }: { favorite: Favorite }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow group">
        <div className={viewMode === "grid" ? "" : "flex gap-4"}>
          {/* Image */}
          {favorite.image && (
            <div className={cn(
              "relative overflow-hidden bg-gray-100",
              viewMode === "grid" ? "h-48 w-full" : "h-32 w-32 flex-shrink-0"
            )}>
              <Image
                src={favorite.image}
                alt={favorite.name || ""}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md">
                {getTypeIcon(favorite.type)}
              </div>
            </div>
          )}
          
          {/* Content */}
          <CardContent className={cn(
            "flex-1",
            viewMode === "grid" ? "p-4" : "p-4"
          )}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 line-clamp-1">
                  {favorite.name || "Unnamed Item"}
                </h3>
                {favorite.category && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {favorite.category}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mt-1 -mr-2"
                onClick={() => removeFavorite(favorite.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
            
            {favorite.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {favorite.description}
              </p>
            )}
            
            {/* Metadata */}
            <div className="space-y-1 text-sm text-gray-500">
              {favorite.price && (
                <div className="font-medium text-gray-900">
                  {formatPrice(favorite.price)}
                </div>
              )}
              
              {favorite.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span>{favorite.rating.toFixed(1)}</span>
                </div>
              )}
              
              {favorite.date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(favorite.date), "MMM dd, yyyy")}</span>
                </div>
              )}
              
              {favorite.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="line-clamp-1">{favorite.location}</span>
                </div>
              )}
            </div>
            
            {/* Notes */}
            {favorite.notes && (
              <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-gray-600 flex gap-1">
                <StickyNote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{favorite.notes}</span>
              </div>
            )}
            
            {/* Actions */}
            <div className="mt-3 flex gap-2">
              <Link href={favorite.href} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button size="sm" className="flex-1">
                Book Now
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saved Items</CardTitle>
              <CardDescription>
                {stats.total} items saved across all categories
              </CardDescription>
            </div>
            <Heart className="h-8 w-8 text-pink-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Providers", count: stats.providers, icon: Users },
              { label: "Services", count: stats.services, icon: Package },
              { label: "Events", count: stats.events, icon: Calendar },
              { label: "Spaces", count: stats.spaces, icon: MapPin },
              { label: "Things", count: stats.things, icon: ShoppingBag },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="p-2 bg-gray-100 rounded-lg inline-block mb-1">
                  <stat.icon className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="provider">Providers</TabsTrigger>
              <TabsTrigger value="service">Services</TabsTrigger>
              <TabsTrigger value="event">Events</TabsTrigger>
              <TabsTrigger value="space">Spaces</TabsTrigger>
              <TabsTrigger value="thing">Things</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search saved items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <TabsContent value={activeTab} className="mt-4">
            {filteredFavorites.length > 0 ? (
              <AnimatePresence mode="popLayout">
                <div className={cn(
                  "grid gap-4",
                  viewMode === "grid" 
                    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
                    : "grid-cols-1"
                )}>
                  {filteredFavorites.map((favorite) => (
                    <FavoriteCard key={favorite.id} favorite={favorite} />
                  ))}
                </div>
              </AnimatePresence>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">
                    {searchQuery 
                      ? "No saved items match your search" 
                      : "No saved items in this category"}
                  </p>
                  <Link href="/marketplace">
                    <Button>Browse Marketplace</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}