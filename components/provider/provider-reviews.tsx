"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star, ThumbsUp, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  reviewText?: string;
  createdAt: string;
  customerName: string;
}

interface ProviderReviewsProps {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

export function ProviderReviews({ 
  reviews, 
  averageRating, 
  totalReviews 
}: ProviderReviewsProps) {
  const [showAll, setShowAll] = useState(false);
  
  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
    percentage: (reviews.filter((r) => r.rating === rating).length / totalReviews) * 100,
  }));

  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 7) return `${diffDays} days ago`;
    if (diffDays <= 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays <= 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="p-6 lg:p-8">
      <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>

      {/* Rating Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Average Rating */}
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {Number(averageRating).toFixed(1)}
          </div>
          <div className="flex justify-center mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-5 w-5",
                  i < Math.floor(averageRating)
                    ? "fill-yellow-400 text-yellow-400"
                    : i < Math.ceil(averageRating) && averageRating % 1 !== 0
                    ? "fill-yellow-400/50 text-yellow-400"
                    : "text-gray-300"
                )}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
          </p>
        </div>

        {/* Rating Distribution */}
        <div className="md:col-span-2 space-y-2">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="flex items-center gap-3">
              <button
                className="flex items-center gap-1 min-w-[3rem] text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                {rating}
                <Star className="h-3 w-3 fill-current" />
              </button>
              <div className="flex-1">
                <Progress value={percentage} className="h-2" />
              </div>
              <span className="text-sm text-gray-600 min-w-[3rem] text-right">
                {count} {count === 1 ? "review" : "reviews"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {displayedReviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border-t pt-4 first:border-0 first:pt-0"
          >
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-500 text-white text-sm">
                  {getInitials(review.customerName)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {review.customerName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {review.reviewText && (
                  <p className="text-gray-700 leading-relaxed">
                    {review.reviewText}
                  </p>
                )}
                
                {/* Review Actions */}
                <div className="flex items-center gap-4 pt-2">
                  <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    <ThumbsUp className="h-4 w-4" />
                    Helpful
                  </button>
                  <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    <MessageSquare className="h-4 w-4" />
                    Reply
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Show More/Less Button */}
      {reviews.length > 3 && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => setShowAll(!showAll)}
            className="min-w-[150px]"
          >
            {showAll ? "Show Less" : `Show All ${reviews.length} Reviews`}
          </Button>
        </div>
      )}
    </Card>
  );
}