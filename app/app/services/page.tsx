"use client";

import React, { useState } from 'react';
import { Search, MapPin, Star, Shield, Clock, DollarSign, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Mock data for service providers
const mockProviders = [
  {
    id: '1',
    name: "Mike's Plumbing",
    category: 'Plumbing',
    rating: 4.9,
    reviews: 127,
    verified: true,
    insured: true,
    backgroundChecked: true,
    distance: 2.3,
    availability: 'Available today',
    startingPrice: 75,
    image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
    description: 'Licensed plumber with 15 years experience',
    responseTime: '2 hours',
  },
  {
    id: '2',
    name: "Sarah's Cleaning",
    category: 'Cleaning',
    rating: 5.0,
    reviews: 43,
    verified: true,
    insured: true,
    backgroundChecked: true,
    distance: 1.8,
    availability: 'Next: Tomorrow 9AM',
    startingPrice: 45,
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    description: 'Professional home cleaning services',
    responseTime: '30 minutes',
  },
  {
    id: '3',
    name: 'Tech Solutions Pro',
    category: 'Technology',
    rating: 4.8,
    reviews: 89,
    verified: true,
    insured: false,
    backgroundChecked: true,
    distance: 3.5,
    availability: 'Available now',
    startingPrice: 100,
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    description: 'Computer repair and IT support',
    responseTime: '1 hour',
  },
  {
    id: '4',
    name: 'Green Thumb Landscaping',
    category: 'Landscaping',
    rating: 4.7,
    reviews: 156,
    verified: true,
    insured: true,
    backgroundChecked: false,
    distance: 4.2,
    availability: 'This week',
    startingPrice: 60,
    image: 'https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=400',
    description: 'Full service lawn care and landscaping',
    responseTime: '4 hours',
  },
];

const categories = [
  'All Services',
  'Cleaning',
  'Plumbing',
  'Electrical',
  'Technology',
  'Landscaping',
  'Moving',
  'Handyman',
];

const priceRanges = [
  'Any Price',
  'Under $50',
  '$50-$100',
  '$100-$200',
  '$200+',
];

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Services');
  const [selectedPrice, setSelectedPrice] = useState('Any Price');
  const [availableToday, setAvailableToday] = useState(false);
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-12 text-lg border-2 focus:border-[#4A90E2]"
                style={{ borderColor: '#4A90E220' }}
              />
            </div>
            
            {/* Location Selector */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A90E2]" />
              <Button 
                variant="outline" 
                className="pl-10 h-12 min-w-[200px] border-2"
                style={{ borderColor: '#4A90E220' }}
              >
                San Francisco
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            {/* Category Filters */}
            <div className="flex gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedCategory === category 
                      ? "bg-[#4A90E2] hover:bg-[#3A7FD1]" 
                      : "hover:bg-[#4A90E210]"
                  )}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
            
            {/* Price Filter */}
            <div className="flex gap-2">
              {priceRanges.map((price) => (
                <Badge
                  key={price}
                  variant={selectedPrice === price ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedPrice === price 
                      ? "bg-[#4A90E2] hover:bg-[#3A7FD1]" 
                      : "hover:bg-[#4A90E210]"
                  )}
                  onClick={() => setSelectedPrice(price)}
                >
                  {price}
                </Badge>
              ))}
            </div>
            
            {/* Availability Toggle */}
            <Badge
              variant={availableToday ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-all",
                availableToday 
                  ? "bg-[#4A90E2] hover:bg-[#3A7FD1]" 
                  : "hover:bg-[#4A90E210]"
              )}
              onClick={() => setAvailableToday(!availableToday)}
            >
              <Clock className="w-3 h-3 mr-1" />
              Available Today
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Service Providers Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockProviders.map((provider, index) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group">
                {/* Provider Header */}
                <div className="p-4 bg-gradient-to-r from-[#4A90E2]/10 to-[#4A90E2]/5">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-16 h-16 border-2 border-white shadow-md">
                      <AvatarImage src={provider.image} alt={provider.name} />
                      <AvatarFallback>{provider.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{provider.name}</h3>
                      <p className="text-sm text-gray-600">{provider.category}</p>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{provider.rating}</span>
                          <span className="text-sm text-gray-500">({provider.reviews})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Badges */}
                <div className="px-4 py-2 bg-gray-50 flex flex-wrap gap-2">
                  {provider.verified && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                  {provider.insured && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Insured
                    </Badge>
                  )}
                  {provider.backgroundChecked && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Background Check
                    </Badge>
                  )}
                </div>
                
                {/* Service Details */}
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-3">{provider.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium">{provider.distance} miles</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Response time:</span>
                      <span className="font-medium">{provider.responseTime}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Availability:</span>
                      <span className="font-medium text-green-600">{provider.availability}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <span className="text-sm text-gray-500">From</span>
                      <div className="text-2xl font-bold text-[#4A90E2]">
                        ${provider.startingPrice}
                      </div>
                    </div>
                    
                    <Button 
                      size="sm"
                      className="bg-[#4A90E2] hover:bg-[#3A7FD1]"
                    >
                      Book Service
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
        
        {/* Load More */}
        <div className="flex justify-center mt-12">
          <Button 
            variant="outline" 
            size="lg"
            className="border-[#4A90E2] text-[#4A90E2] hover:bg-[#4A90E210]"
          >
            Load More Providers
          </Button>
        </div>
      </div>
    </div>
  );
}