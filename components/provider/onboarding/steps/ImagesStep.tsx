/**
 * Images Step Component
 * 
 * Allows providers to upload profile and gallery images
 */

"use client";

import { useState } from "react";
import { useProviderOnboardingStore } from "@/lib/stores/provider-onboarding-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  InfoIcon,
  User,
  Camera
} from "lucide-react";
import Image from "next/image";

export default function ImagesStep() {
  const { 
    images, 
    updateImages, 
    addGalleryImage,
    removeGalleryImage 
  } = useProviderOnboardingStore();
  
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Placeholder upload handler - replace with actual upload logic
  const handleImageUpload = async (
    file: File, 
    type: "profile" | "cover" | "gallery"
  ) => {
    // TODO: Implement actual image upload to storage
    // For now, create a local URL for preview
    const url = URL.createObjectURL(file);
    
    if (type === "profile") {
      setUploadingProfile(true);
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateImages({ profileImageUrl: url });
      setUploadingProfile(false);
    } else if (type === "cover") {
      setUploadingCover(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateImages({ coverImageUrl: url });
      setUploadingCover(false);
    } else if (type === "gallery") {
      setUploadingGallery(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      addGalleryImage(url);
      setUploadingGallery(false);
    }
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "profile" | "cover" | "gallery"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB");
        return;
      }
      handleImageUpload(file, type);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Add photos to make your profile stand out. High-quality images help build trust with potential customers.
        </AlertDescription>
      </Alert>

      {/* Profile Image */}
      <Card>
        <CardContent className="p-6">
          <Label className="text-base font-semibold mb-4 block">
            Profile Photo
          </Label>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="relative">
              {images.profileImageUrl ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-gray-200">
                  <Image
                    src={images.profileImageUrl}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => updateImages({ profileImageUrl: null })}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 m-1"
                    aria-label="Remove profile image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-3">
                Your profile photo will be displayed on your public profile and in search results.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingProfile}
                  onClick={() => document.getElementById("profile-upload")?.click()}
                >
                  {uploadingProfile ? (
                    "Uploading..."
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photo
                    </>
                  )}
                </Button>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "profile")}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cover Image */}
      <Card>
        <CardContent className="p-6">
          <Label className="text-base font-semibold mb-4 block">
            Cover Photo
          </Label>
          <div className="space-y-4">
            {images.coverImageUrl ? (
              <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200">
                <Image
                  src={images.coverImageUrl}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
                <button
                  onClick={() => updateImages({ coverImageUrl: null })}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                  aria-label="Remove cover image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-full h-48 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No cover image</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600 mb-3">
                A cover photo helps personalize your profile page.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={uploadingCover}
                onClick={() => document.getElementById("cover-upload")?.click()}
              >
                {uploadingCover ? (
                  "Uploading..."
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Cover Photo
                  </>
                )}
              </Button>
              <input
                id="cover-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "cover")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Images */}
      <Card>
        <CardContent className="p-6">
          <Label className="text-base font-semibold mb-4 block">
            Gallery Photos ({images.galleryImages.length}/10)
          </Label>
          <p className="text-sm text-gray-600 mb-4">
            Showcase your work with up to 10 gallery photos.
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.galleryImages.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                <Image
                  src={img}
                  alt={`Gallery ${index + 1}`}
                  fill
                  className="object-cover"
                />
                <button
                  onClick={() => removeGalleryImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                  aria-label={`Remove gallery image ${index + 1}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            
            {images.galleryImages.length < 10 && (
              <button
                onClick={() => document.getElementById("gallery-upload")?.click()}
                disabled={uploadingGallery}
                className="aspect-square rounded-lg bg-gray-100 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:bg-gray-50 transition-colors"
              >
                {uploadingGallery ? (
                  <p className="text-sm text-gray-500">Uploading...</p>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">Add Photo</p>
                  </>
                )}
              </button>
            )}
            
            <input
              id="gallery-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, "gallery")}
            />
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          Images are optional but highly recommended. Profiles with photos receive 3x more bookings.
        </AlertDescription>
      </Alert>
    </div>
  );
}