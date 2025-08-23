"use client";

import { useState } from "react";
import { Provider } from "@/db/schema/providers-schema";
import { ImageUpload, GalleryUpload } from "@/components/provider/image-upload";
import { updateProviderProfileAction } from "@/actions/providers-actions";
import { uploadProviderImage, deleteProviderImage, ImageType } from "@/lib/supabase/storage-helpers";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Image as ImageIcon, Loader2 } from "lucide-react";

interface MediaSectionProps {
  provider: Provider;
  onUpdate: (provider: Provider) => void;
  onSaveStart: () => void;
  onSaveError: (error: string) => void;
}

export function MediaSection({
  provider,
  onUpdate,
  onSaveStart,
  onSaveError,
}: MediaSectionProps) {
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>(
    (provider.galleryImages as string[]) || []
  );

  // Handle profile image upload
  const handleProfileImageUpload = async (file: File) => {
    setIsUploadingProfile(true);
    onSaveStart();

    try {
      // Upload to Supabase
      const publicUrl = await uploadProviderImage(file, ImageType.PROFILE, provider.id);

      // Update provider profile
      const result = await updateProviderProfileAction(provider.id, {
        profileImageUrl: publicUrl,
      });

      if (result.isSuccess && result.data) {
        onUpdate(result.data);
        toast.success("Profile image updated");
        return { publicUrl };
      } else {
        throw new Error(result.message || "Failed to update profile image");
      }
    } catch (error) {
      onSaveError(error instanceof Error ? error.message : "Upload failed");
      throw error;
    } finally {
      setIsUploadingProfile(false);
    }
  };

  // Handle profile image removal
  const handleProfileImageRemove = async () => {
    onSaveStart();

    try {
      // Delete from Supabase if exists
      if (provider.profileImageUrl) {
        await deleteProviderImage(provider.profileImageUrl);
      }

      // Update provider profile
      const result = await updateProviderProfileAction(provider.id, {
        profileImageUrl: null,
      });

      if (result.isSuccess && result.data) {
        onUpdate(result.data);
        toast.success("Profile image removed");
      } else {
        throw new Error(result.message || "Failed to remove profile image");
      }
    } catch (error) {
      onSaveError(error instanceof Error ? error.message : "Remove failed");
      throw error;
    }
  };

  // Handle cover image upload
  const handleCoverImageUpload = async (file: File) => {
    setIsUploadingCover(true);
    onSaveStart();

    try {
      // Upload to Supabase
      const publicUrl = await uploadProviderImage(file, ImageType.COVER, provider.id);

      // Update provider profile
      const result = await updateProviderProfileAction(provider.id, {
        coverImageUrl: publicUrl,
      });

      if (result.isSuccess && result.data) {
        onUpdate(result.data);
        toast.success("Cover image updated");
        return { publicUrl };
      } else {
        throw new Error(result.message || "Failed to update cover image");
      }
    } catch (error) {
      onSaveError(error instanceof Error ? error.message : "Upload failed");
      throw error;
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Handle cover image removal
  const handleCoverImageRemove = async () => {
    onSaveStart();

    try {
      // Delete from Supabase if exists
      if (provider.coverImageUrl) {
        await deleteProviderImage(provider.coverImageUrl);
      }

      // Update provider profile
      const result = await updateProviderProfileAction(provider.id, {
        coverImageUrl: null,
      });

      if (result.isSuccess && result.data) {
        onUpdate(result.data);
        toast.success("Cover image removed");
      } else {
        throw new Error(result.message || "Failed to remove cover image");
      }
    } catch (error) {
      onSaveError(error instanceof Error ? error.message : "Remove failed");
      throw error;
    }
  };

  // Handle gallery image upload
  const handleGalleryImageUpload = async (file: File, index: number) => {
    onSaveStart();

    try {
      // Upload to Supabase
      const publicUrl = await uploadProviderImage(
        file,
        ImageType.GALLERY,
        provider.id,
        index
      );

      // Update gallery images array
      const updatedGallery = [...galleryImages];
      updatedGallery[index] = publicUrl;

      // Update provider profile
      const result = await updateProviderProfileAction(provider.id, {
        galleryImages: updatedGallery.filter(Boolean), // Remove empty slots
      });

      if (result.isSuccess && result.data) {
        onUpdate(result.data);
        setGalleryImages(updatedGallery);
        toast.success("Gallery image added");
        return { publicUrl };
      } else {
        throw new Error(result.message || "Failed to add gallery image");
      }
    } catch (error) {
      onSaveError(error instanceof Error ? error.message : "Upload failed");
      throw error;
    }
  };

  // Handle gallery image removal
  const handleGalleryImageRemove = async (index: number) => {
    onSaveStart();

    try {
      const imageUrl = galleryImages[index];
      
      // Delete from Supabase if exists
      if (imageUrl) {
        await deleteProviderImage(imageUrl);
      }

      // Update gallery images array
      const updatedGallery = [...galleryImages];
      updatedGallery[index] = "";

      // Update provider profile
      const result = await updateProviderProfileAction(provider.id, {
        galleryImages: updatedGallery.filter(Boolean), // Remove empty slots
      });

      if (result.isSuccess && result.data) {
        onUpdate(result.data);
        setGalleryImages(updatedGallery);
        toast.success("Gallery image removed");
      } else {
        throw new Error(result.message || "Failed to remove gallery image");
      }
    } catch (error) {
      onSaveError(error instanceof Error ? error.message : "Remove failed");
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile & Cover Images */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Image */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Profile Image
            </CardTitle>
            <CardDescription>
              Your main profile photo that customers will see
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload
              onUpload={handleProfileImageUpload}
              onRemove={handleProfileImageRemove}
              currentImageUrl={provider.profileImageUrl}
              label=""
              description="Recommended: Square image, at least 400x400px"
              aspectRatio="square"
              disabled={isUploadingProfile}
            />
          </CardContent>
        </Card>

        {/* Cover Image */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Cover Image
            </CardTitle>
            <CardDescription>
              Banner image for your profile page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload
              onUpload={handleCoverImageUpload}
              onRemove={handleCoverImageRemove}
              currentImageUrl={provider.coverImageUrl}
              label=""
              description="Recommended: 1920x480px or 4:1 aspect ratio"
              aspectRatio="banner"
              disabled={isUploadingCover}
            />
          </CardContent>
        </Card>
      </div>

      {/* Gallery Images */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Gallery</CardTitle>
          <CardDescription>
            Showcase your work with up to 12 images. These help customers understand
            the quality of your services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GalleryUpload
            images={galleryImages}
            maxImages={12}
            onUpload={handleGalleryImageUpload}
            onRemove={handleGalleryImageRemove}
          />
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h4 className="mb-2 text-sm font-medium">Image Tips</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Use high-quality, well-lit photos</li>
            <li>• Show before and after results when applicable</li>
            <li>• Include images of your tools or workspace</li>
            <li>• Ensure all images are professional and appropriate</li>
            <li>• Avoid including personal information in images</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}