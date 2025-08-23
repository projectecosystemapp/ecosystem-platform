"use client";

import React, { useState } from 'react';
import { Search, MapPin, Calendar, Filter, Star, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Mock data for events
const mockEvents = [
  {
    id: '1',
    title: 'Live Jazz Night',
    date: 'Mar 15, 8:00 PM',
    location: 'Downtown Jazz Club',
    price: 25,
    image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400',
    rating: 4.8,
    reviews: 24,
    host: "Mike's Music Events",
    attendees: 42,
    maxAttendees: 50,
  },
  {
    id: '2',
    title: 'Italian Cooking Class',
    date: 'Mar 16, 6:00 PM',
    location: 'Culinary Institute',
    price: 75,
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    rating: 4.9,
    reviews: 87,
    host: 'Chef Maria',
    attendees: 8,
    maxAttendees: 12,
  },
  {
    id: '3',
    title: 'Yoga & Meditation Workshop',
    date: 'Mar 17, 9:00 AM',
    location: 'Zen Studio',
    price: 35,
    image: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400',
    rating: 5.0,
    reviews: 156,
    host: 'Mindful Movement',
    attendees: 15,
    maxAttendees: 20,
  },
  {
    id: '4',
    title: 'Tech Startup Networking',
    date: 'Mar 18, 7:00 PM',
    location: 'Innovation Hub',
    price: 0,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
    rating: 4.5,
    reviews: 43,
    host: 'StartupSF',
    attendees: 78,
    maxAttendees: 100,
  },
];

const categories = [
  'All Events',
  'Music',
  'Food & Drink',
  'Sports',
  'Arts & Culture',
  'Business',
  'Wellness',
];

const dateFilters = [
  'Today',
  'This Week',
  'This Month',
  'Next Month',
];

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Events');
  const [selectedDate, setSelectedDate] = useState('This Week');
  
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
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-12 text-lg border-2 focus:border-[#FF6B47]"
                style={{ borderColor: '#FF6B4720' }}
              />
            </div>
            
            {/* Location Selector */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FF6B47]" />
              <Button 
                variant="outline" 
                className="pl-10 h-12 min-w-[200px] border-2"
                style={{ borderColor: '#FF6B4720' }}
              >
                San Francisco
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#FF6B47]" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            {/* Date Filters */}
            <div className="flex gap-2">
              {dateFilters.map((date) => (
                <Badge
                  key={date}
                  variant={selectedDate === date ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedDate === date 
                      ? "bg-[#FF6B47] hover:bg-[#FF5533]" 
                      : "hover:bg-[#FF6B4710]"
                  )}
                  onClick={() => setSelectedDate(date)}
                >
                  {date}
                </Badge>
              ))}
            </div>
            
            {/* Category Filters */}
            <div className="flex gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedCategory === category 
                      ? "bg-[#FF6B47] hover:bg-[#FF5533]" 
                      : "hover:bg-[#FF6B4710]"
                  )}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
            
            {/* Price Filter */}
            <Badge variant="outline" className="cursor-pointer hover:bg-[#FF6B4710]">
              Any Price
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Events Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group">
                {/* Event Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  {event.price === 0 && (
                    <Badge className="absolute top-2 right-2 bg-green-500">
                      FREE
                    </Badge>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <h3 className="text-white font-semibold text-lg">{event.title}</h3>
                  </div>
                </div>
                
                {/* Event Details */}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>{event.date}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{event.rating}</span>
                      <span className="text-sm text-gray-500">({event.reviews})</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{event.attendees}/{event.maxAttendees}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      {event.price > 0 ? (
                        <span className="text-2xl font-bold text-[#FF6B47]">
                          ${event.price}
                          <span className="text-sm text-gray-500 font-normal">/person</span>
                        </span>
                      ) : (
                        <span className="text-2xl font-bold text-green-500">FREE</span>
                      )}
                    </div>
                    
                    <Button 
                      size="sm"
                      className="bg-[#FF6B47] hover:bg-[#FF5533]"
                    >
                      Book Event
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
            className="border-[#FF6B47] text-[#FF6B47] hover:bg-[#FF6B4710]"
          >
            Load More Events
          </Button>
        </div>
      </div>
    </div>
  );
}