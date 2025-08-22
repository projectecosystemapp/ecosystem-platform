"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ThumbsUp, MessageSquare, CheckCircle, Filter, ChevronDown, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Review {
  id: string;
  customerName: string;
  customerImage?: string;
  rating: number;
  comment: string;
  serviceName?: string;
  createdAt: Date;
  verified?: boolean;
  helpful?: number;
}

interface Testimonial {
  id: string;
  customerName: string;
  customerImage?: string;
  testimonialText: string;
  isFeatured?: boolean;
  createdAt: Date;
}

interface ProviderReviewsProps {
  reviews: Review[];
  testimonials: Testimonial[];
  averageRating?: number;
  totalReviews?: number;
}

export default function ProviderReviews({
  reviews = [],
  testimonials = [],
  averageRating = 0,
  totalReviews = 0,
}: ProviderReviewsProps) {
  const [sortBy, setSortBy] = useState<"recent" | "helpful" | "rating">("recent");
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [helpfulReviews, setHelpfulReviews] = useState<Set<string>>(new Set());

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => Math.floor(r.rating) === rating).length,
    percentage: totalReviews > 0 
      ? (reviews.filter(r => Math.floor(r.rating) === rating).length / totalReviews) * 100 
      : 0,
  }));

  // Sort and filter reviews
  let sortedReviews = [...reviews];
  
  if (filterRating) {
    sortedReviews = sortedReviews.filter(r => Math.floor(r.rating) === filterRating);
  }

  sortedReviews.sort((a, b) => {
    switch (sortBy) {
      case "helpful":
        return (b.helpful || 0) - (a.helpful || 0);
      case "rating":
        return b.rating - a.rating;
      case "recent":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const handleHelpful = (reviewId: string) => {
    setHelpfulReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const renderStars = (rating: number, size = "sm") => {
    const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClass,
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-600" />
              Reviews & Testimonials
            </CardTitle>
            <CardDescription className="mt-1">
              See what customers are saying
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="reviews" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reviews">
              Reviews ({totalReviews})
            </TabsTrigger>
            <TabsTrigger value="testimonials">
              Testimonials ({testimonials.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-6">
            {/* Rating Summary */}
            {totalReviews > 0 && (
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Average Rating */}
                  <div className="text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <div className="text-5xl font-bold text-gray-900">
                        {Number(averageRating).toFixed(1)}
                      </div>
                      <div>
                        {renderStars(averageRating, "lg")}
                        <p className="text-sm text-gray-600 mt-1">
                          Based on {totalReviews} review{totalReviews !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rating Distribution */}
                  <div className="space-y-2">
                    {ratingDistribution.map(({ rating, count, percentage }) => (
                      <button
                        key={rating}
                        onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                        className={cn(
                          "flex items-center gap-2 w-full hover:bg-gray-100 rounded px-2 py-1 transition-colors",
                          filterRating === rating && "bg-blue-50"
                        )}
                      >
                        <span className="text-sm w-4">{rating}</span>
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <Progress value={percentage} className="flex-1 h-2" />
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Filters and Sort */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex items-center gap-2">
                {filterRating && (
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => setFilterRating(null)}
                  >
                    {filterRating} stars
                    <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Sort by: {sortBy === "recent" ? "Most Recent" : sortBy === "helpful" ? "Most Helpful" : "Highest Rated"}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("recent")}>
                    Most Recent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("helpful")}>
                    Most Helpful
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("rating")}>
                    Highest Rated
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
              <AnimatePresence>
                {sortedReviews.map((review, index) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage src={review.customerImage} />
                          <AvatarFallback>
                            {review.customerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">
                              {review.customerName}
                            </h4>
                            {review.verified && (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {renderStars(review.rating)}
                            <span className="text-sm text-gray-500">
                              {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          {review.serviceName && (
                            <p className="text-sm text-gray-600 mt-1">
                              Service: {review.serviceName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-700 leading-relaxed mb-4">
                      {review.comment}
                    </p>

                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHelpful(review.id)}
                        className={cn(
                          "gap-2",
                          helpfulReviews.has(review.id) && "text-blue-600"
                        )}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Helpful ({(review.helpful || 0) + (helpfulReviews.has(review.id) ? 1 : 0)})
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {sortedReviews.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    {filterRating
                      ? `No ${filterRating}-star reviews yet`
                      : "No reviews yet"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Be the first to leave a review!
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="testimonials" className="space-y-4">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "border rounded-lg p-6",
                  testimonial.isFeatured && "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                )}
              >
                {testimonial.isFeatured && (
                  <Badge className="mb-3 bg-blue-600">Featured</Badge>
                )}
                <blockquote className="text-gray-700 leading-relaxed italic mb-4">
                  "{testimonial.testimonialText}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={testimonial.customerImage} />
                    <AvatarFallback>
                      {testimonial.customerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {testimonial.customerName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(testimonial.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {testimonials.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No testimonials yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}