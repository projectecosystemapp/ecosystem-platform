"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Testimonial {
  id: string;
  customerName: string;
  customerImage?: string;
  testimonialText: string;
  isFeatured: boolean;
  createdAt: string;
}

interface ProviderTestimonialsProps {
  testimonials: Testimonial[];
}

export function ProviderTestimonials({ testimonials }: ProviderTestimonialsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Filter featured testimonials first, then non-featured
  const sortedTestimonials = [...testimonials].sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return 0;
  });

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % sortedTestimonials.length);
  }, [sortedTestimonials.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? sortedTestimonials.length - 1 : prev - 1
    );
  };

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlaying || sortedTestimonials.length <= 1) return;
    
    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, currentIndex, sortedTestimonials.length, goToNext]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (sortedTestimonials.length === 0) return null;

  const currentTestimonial = sortedTestimonials[currentIndex];

  return (
    <Card className="p-6 lg:p-8 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Quote className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Client Testimonials</h2>
        </div>
        {sortedTestimonials.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsAutoPlaying(false);
                goToPrevious();
              }}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-500 min-w-[3rem] text-center">
              {currentIndex + 1} / {sortedTestimonials.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsAutoPlaying(false);
                goToNext();
              }}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTestimonial.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Testimonial Text */}
            <div className="relative">
              <Quote className="absolute -top-2 -left-2 h-8 w-8 text-blue-100" />
              <blockquote className="relative z-10 text-lg text-gray-700 italic leading-relaxed pl-6">
                &ldquo;{currentTestimonial.testimonialText}&rdquo;
              </blockquote>
            </div>

            {/* Customer Info */}
            <div className="flex items-center gap-3 pt-4">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={currentTestimonial.customerImage}
                  alt={currentTestimonial.customerName}
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  {getInitials(currentTestimonial.customerName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-900">
                  {currentTestimonial.customerName}
                </p>
                {currentTestimonial.isFeatured && (
                  <p className="text-sm text-blue-600 font-medium">
                    Featured Review
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots Indicator */}
      {sortedTestimonials.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-6">
          {sortedTestimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsAutoPlaying(false);
                setCurrentIndex(index);
              }}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "bg-blue-600 w-6"
                  : "bg-gray-300 hover:bg-gray-400"
              )}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}