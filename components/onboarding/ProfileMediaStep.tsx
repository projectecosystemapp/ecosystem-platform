"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  Image as ImageIcon, 
  Camera,
  X,
  Info,
  Loader2
} from "lucide-react";
import Image from "next/image";
import type { OnboardingData } from "@/app/become-a-provider/onboarding/page";

interface ProfileMediaStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  errors: Record<string, string>;
}

export default function ProfileMediaStep({
  data,
  updateData,
  errors,
}: ProfileMediaStepProps) {
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Handle file upload (placeholder - would integrate with actual upload service)
  const handleFileUpload = useCallback(async (
    files: FileList,
    type: "profile" | "cover" | "gallery"
  ) => {
    // In production, this would upload to Supabase Storage or similar
    // For now, we'll create object URLs as placeholders
    
    const uploadPromises = Array.from(files).map(async (file) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload only image files");
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image size must be less than 5MB");
      }
      
      // In production, upload to storage and return URL
      // For demo, return object URL
      return URL.createObjectURL(file);
    });

    try {
      const urls = await Promise.all(uploadPromises);
      
      if (type === "profile") {
        updateData({ profileImageUrl: urls[0] });
      } else if (type === "cover") {
        updateData({ coverImageUrl: urls[0] });
      } else if (type === "gallery") {
        const currentGallery = data.galleryImages || [];
        const newGallery = [...currentGallery, ...urls].slice(0, 12); // Max 12 images
        updateData({ galleryImages: newGallery });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  }, [data.galleryImages, updateData]);

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingProfile(true);
    try {
      await handleFileUpload(e.target.files, "profile");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingCover(true);
    try {
      await handleFileUpload(e.target.files, "cover");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingGallery(true);
    try {
      await handleFileUpload(e.target.files, "gallery");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    const newGallery = [...(data.galleryImages || [])];
    newGallery.splice(index, 1);
    updateData({ galleryImages: newGallery });
  };

  return (
    <div className="space-y-6">
      {/* Profile Image */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Profile Photo
          </CardTitle>
          <CardDescription>
            This will be your main profile picture that customers see
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              {data.profileImageUrl ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200">
                  <Image
                    src={data.profileImageUrl}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                  <Camera className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <input
                  type="file"
                  id="profile-image"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className="hidden"
                  disabled={uploadingProfile}
                />
                <label htmlFor="profile-image">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingProfile}
                    className="cursor-pointer"
                    asChild
                  >
                    <span>
                      {uploadingProfile ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {data.profileImageUrl ? "Change Photo" : "Upload Photo"}
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-sm text-gray-600">
                Recommended: Square image, at least 400x400px, JPG or PNG
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cover Image */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Cover Image
          </CardTitle>
          <CardDescription>
            A banner image that appears at the top of your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.coverImageUrl ? (
              <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                <Image
                  src={data.coverImageUrl}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
                <button
                  onClick={() => updateData({ coverImageUrl: undefined })}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center">
                <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                <p className="text-gray-600">No cover image uploaded</p>
              </div>
            )}
            
            <div>
              <input
                type="file"
                id="cover-image"
                accept="image/*"
                onChange={handleCoverImageChange}
                className="hidden"
                disabled={uploadingCover}
              />
              <label htmlFor="cover-image">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingCover}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    {uploadingCover ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {data.coverImageUrl ? "Change Cover" : "Upload Cover"}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>
            <p className="text-sm text-gray-600">
              Recommended: 1920x480px or wider, JPG or PNG
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Portfolio Gallery
          </CardTitle>
          <CardDescription>
            Showcase your best work (up to 12 images)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Gallery Grid */}
            {data.galleryImages && data.galleryImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {data.galleryImages.map((image, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                    <Image
                      src={image}
                      alt={`Gallery ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={() => removeGalleryImage(index)}
                      className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Upload Button */}
            {(!data.galleryImages || data.galleryImages.length < 12) && (
              <div>
                <input
                  type="file"
                  id="gallery-images"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryImagesChange}
                  className="hidden"
                  disabled={uploadingGallery}
                />
                <label htmlFor="gallery-images">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingGallery}
                    className="cursor-pointer"
                    asChild
                  >
                    <span>
                      {uploadingGallery ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Add Gallery Images
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            )}
            
            <p className="text-sm text-gray-600">
              {data.galleryImages?.length || 0}/12 images uploaded. 
              These images will help customers understand your work quality.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Image Tips:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Use high-quality, professional photos that represent your best work</li>
            <li>• Include a clear, friendly profile photo to build trust</li>
            <li>• Show variety in your gallery to demonstrate your range</li>
            <li>• Images are optional but profiles with photos get 5x more bookings</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}