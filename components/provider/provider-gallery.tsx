"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ProviderGalleryProps {
  images: string[];
}

export function ProviderGallery({ images }: ProviderGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedImageIndex(null);
  };

  const navigateImage = (direction: "prev" | "next") => {
    if (selectedImageIndex === null) return;
    
    const newIndex = direction === "prev"
      ? (selectedImageIndex - 1 + images.length) % images.length
      : (selectedImageIndex + 1) % images.length;
    
    setSelectedImageIndex(newIndex);
  };

  // Determine grid layout based on number of images
  const getGridClass = () => {
    const count = Math.min(images.length, 12);
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 sm:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 sm:grid-cols-3";
    return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  };

  const displayImages = images.slice(0, 12); // Limit to 12 images

  return (
    <>
      <Card className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Portfolio Gallery</h2>
          <span className="text-sm text-gray-500">
            {displayImages.length} {displayImages.length === 1 ? "image" : "images"}
          </span>
        </div>

        <div className={cn("grid gap-4", getGridClass())}>
          {displayImages.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              <Image
                src={image}
                alt={`Portfolio image ${index + 1}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-110"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                <Expand className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </motion.div>
          ))}
        </div>

        {images.length > 12 && (
          <p className="text-sm text-gray-500 text-center mt-4">
            Showing first 12 images of {images.length} total
          </p>
        )}
      </Card>

      {/* Lightbox Modal */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/95">
          <div className="relative w-full h-full min-h-[50vh]">
            {selectedImageIndex !== null && (
              <>
                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
                  onClick={closeLightbox}
                >
                  <X className="h-6 w-6" />
                </Button>

                {/* Navigation Buttons */}
                {images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateImage("prev");
                      }}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateImage("next");
                      }}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </>
                )}

                {/* Image Display */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedImageIndex}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full h-full flex items-center justify-center p-8"
                  >
                    <Image
                      src={images[selectedImageIndex]}
                      alt={`Portfolio image ${selectedImageIndex + 1}`}
                      width={1200}
                      height={800}
                      className="object-contain max-w-full max-h-full"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Image Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                  {selectedImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}