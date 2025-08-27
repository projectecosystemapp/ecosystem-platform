"use server";

import {
  createProvider,
  getProviderByUserId,
  getProviderById,
  getProviderBySlug,
  updateProvider,
  searchProviders,
  getFeaturedProviders,
  generateUniqueSlug,
  getProviderAvailability,
  setProviderAvailability,
  getAvailableServices,
  getLocationSuggestions,
  getPriceRangeStats,
} from "@/db/queries/providers-queries";
import { 
  type Provider, 
  type NewProvider,
  type ProviderAvailability,
  type NewProviderAvailability,
} from "@/db/schema/providers-schema";
import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { sanitizationSchemas, sanitizeText, sanitizeNumber } from "@/lib/security/input-sanitization";

// Validation schema for provider creation
const createProviderSchema = z.object({
  displayName: sanitizationSchemas.providerName,
  tagline: z.string().max(100).optional().transform(val => val ? sanitizeText(val) : undefined),
  bio: sanitizationSchemas.providerBio.optional(),
  locationCity: z.string().max(50).optional().transform(val => val ? sanitizeText(val) : undefined),
  locationState: z.string().max(50).optional().transform(val => val ? sanitizeText(val) : undefined),
  hourlyRate: z.number().min(0).max(10000).optional(),
  yearsExperience: z.number().min(0).max(100).optional(),
  services: z.array(z.object({
    name: sanitizationSchemas.serviceName,
    description: sanitizationSchemas.serviceDescription,
    duration: z.number().min(15).max(480),
    price: z.number().min(0).max(100000),
  })).optional(),
});

// Create a new provider profile
export async function createProviderAction(rawData: unknown): Promise<ActionResult<Provider>> {
  try {
    // Validate and sanitize input
    const validationResult = createProviderSchema.safeParse(rawData);
    if (!validationResult.success) {
      return { 
        isSuccess: false, 
        message: "Invalid input: " + validationResult.error.issues.map((e: any) => e.message).join(", ") 
      };
    }
    
    const data = validationResult.data;
    
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Check if provider profile already exists
    const existingProvider = await getProviderByUserId(userId);
    if (existingProvider) {
      return { isSuccess: false, message: "Provider profile already exists" };
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(data.displayName);

    const providerData: NewProvider = {
      userId,
      displayName: data.displayName,
      slug,
      tagline: data.tagline,
      bio: data.bio,
      locationCity: data.locationCity,
      locationState: data.locationState,
      hourlyRate: data.hourlyRate?.toString(),
      yearsExperience: data.yearsExperience,
      services: data.services || [],
    };

    const newProvider = await createProvider(providerData);
    
    // Audit log for provider creation
    console.log(`[AUDIT] User ${userId} created provider profile ${newProvider.id} at ${new Date().toISOString()}`);
    
    revalidatePath("/dashboard/provider");
    revalidatePath("/providers");
    
    return {
      isSuccess: true,
      message: "Provider profile created successfully",
      data: newProvider,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create provider profile";
    return { isSuccess: false, message: errorMessage };
  }
}

// Get current user's provider profile
export async function getMyProviderProfileAction(): Promise<ActionResult<Provider | null>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const provider = await getProviderByUserId(userId);
    
    return {
      isSuccess: true,
      message: provider ? "Provider profile retrieved" : "No provider profile found",
      data: provider,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get provider profile" };
  }
}

// Get provider profile by slug (public)
export async function getProviderBySlugAction(slug: string): Promise<ActionResult<Provider | null>> {
  try {
    const provider = await getProviderBySlug(slug);
    
    if (!provider || !provider.isActive) {
      return { isSuccess: false, message: "Provider not found" };
    }

    return {
      isSuccess: true,
      message: "Provider retrieved successfully",
      data: provider,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get provider" };
  }
}

// Update provider profile
export async function updateProviderAction(
  data: Partial<{
    displayName: string;
    tagline: string;
    bio: string;
    coverImageUrl: string;
    profileImageUrl: string;
    galleryImages: string[];
    locationCity: string;
    locationState: string;
    hourlyRate: number;
    services: Array<{
      name: string;
      description: string;
      duration: number;
      price: number;
    }>;
    yearsExperience: number;
  }>
): Promise<ActionResult<Provider>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const provider = await getProviderByUserId(userId);
    
    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    const updateData: Partial<NewProvider> = {
      ...data,
      hourlyRate: data.hourlyRate?.toString(),
    };

    // If display name changed, regenerate slug
    if (data.displayName && data.displayName !== provider.displayName) {
      updateData.slug = await generateUniqueSlug(data.displayName);
    }

    const updatedProvider = await updateProvider(provider.id, updateData);
    
    // Audit log for provider updates
    console.log(`[AUDIT] User ${userId} updated provider profile ${provider.id} at ${new Date().toISOString()}`);
    
    revalidatePath("/dashboard/provider");
    revalidatePath(`/providers/${provider.slug}`);
    if (updateData.slug) {
      revalidatePath(`/providers/${updateData.slug}`);
    }
    
    return {
      isSuccess: true,
      message: "Provider profile updated successfully",
      data: updatedProvider,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update provider profile";
    return { isSuccess: false, message: errorMessage };
  }
}

// Search providers with filters
export async function searchProvidersAction(
  filters?: {
    query?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    services?: string[];
    verifiedOnly?: boolean;
    hasInsurance?: boolean;
    instantBooking?: boolean;
    availability?: {
      days?: string[];
      timeOfDay?: string[];
    };
    sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'reviews' | 'distance' | 'newest';
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResult<{ providers: Provider[]; total: number }>> {
  try {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const result = await searchProviders({
      query: filters?.query,
      city: filters?.city,
      state: filters?.state,
      zipCode: filters?.zipCode,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
      minRating: filters?.minRating,
      services: filters?.services,
      verifiedOnly: filters?.verifiedOnly,
      hasInsurance: filters?.hasInsurance,
      instantBooking: filters?.instantBooking,
      availability: filters?.availability,
      sortBy: filters?.sortBy,
      limit: pageSize,
      offset,
    });

    return {
      isSuccess: true,
      message: "Providers retrieved successfully",
      data: result,
    };
  } catch (error) {
    console.error("Search providers error:", error);
    return { isSuccess: false, message: "Failed to search providers" };
  }
}

// Get featured providers for homepage
export async function getFeaturedProvidersAction(
  limit: number = 6
): Promise<ActionResult<Provider[]>> {
  try {
    const providers = await getFeaturedProviders(limit);
    
    return {
      isSuccess: true,
      message: "Featured providers retrieved successfully",
      data: providers,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get featured providers" };
  }
}

// Toggle provider active status
export async function toggleProviderStatusAction(
  isActive: boolean
): Promise<ActionResult<Provider>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const provider = await getProviderByUserId(userId);
    
    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    const updatedProvider = await updateProvider(provider.id, { isActive });
    
    // Audit log for status changes
    console.log(`[AUDIT] User ${userId} ${isActive ? "activated" : "deactivated"} provider profile ${provider.id} at ${new Date().toISOString()}`);
    
    revalidatePath("/dashboard/provider");
    revalidatePath(`/providers/${provider.slug}`);
    
    return {
      isSuccess: true,
      message: `Provider profile ${isActive ? "activated" : "deactivated"} successfully`,
      data: updatedProvider,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to update provider status" };
  }
}

// Get provider availability (public)
export async function getProviderAvailabilityAction(
  providerId: string
): Promise<ActionResult<ProviderAvailability[]>> {
  try {
    const availability = await getProviderAvailability(providerId);
    
    return {
      isSuccess: true,
      message: "Availability retrieved successfully",
      data: availability,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get availability" };
  }
}

// Update provider images
export async function updateProviderImagesAction(
  imageType: "cover" | "profile" | "gallery",
  imageUrls: string | string[]
): Promise<ActionResult<Provider>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const provider = await getProviderByUserId(userId);
    
    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    let updateData: Partial<NewProvider> = {};

    switch (imageType) {
      case "cover":
        updateData.coverImageUrl = imageUrls as string;
        break;
      case "profile":
        updateData.profileImageUrl = imageUrls as string;
        break;
      case "gallery":
        updateData.galleryImages = imageUrls as string[];
        break;
    }

    const updatedProvider = await updateProvider(provider.id, updateData);
    
    revalidatePath("/dashboard/provider");
    revalidatePath(`/providers/${provider.slug}`);
    
    return {
      isSuccess: true,
      message: "Images updated successfully",
      data: updatedProvider,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to update images" };
  }
}

// Update provider services
export async function updateProviderServicesAction(
  services: Array<{
    name: string;
    description: string;
    duration: number;
    price: number;
  }>
): Promise<ActionResult<Provider>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const provider = await getProviderByUserId(userId);
    
    if (!provider) {
      return { isSuccess: false, message: "Provider profile not found" };
    }

    const updatedProvider = await updateProvider(provider.id, { services });
    
    revalidatePath("/dashboard/provider");
    revalidatePath(`/providers/${provider.slug}`);
    
    return {
      isSuccess: true,
      message: "Services updated successfully",
      data: updatedProvider,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to update services" };
  }
}

// Check if user has a provider profile
export async function hasProviderProfileAction(): Promise<ActionResult<boolean>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    const provider = await getProviderByUserId(userId);
    
    return {
      isSuccess: true,
      message: "Check completed",
      data: !!provider,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to check provider profile" };
  }
}

// Update provider profile with authorization check
export async function updateProviderProfileAction(
  providerId: string,
  data: Partial<NewProvider>
): Promise<ActionResult<Provider>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Verify the provider belongs to the current user
    const provider = await getProviderById(providerId);
    
    if (!provider) {
      return { isSuccess: false, message: "Provider not found" };
    }

    if (provider.userId !== userId) {
      return { isSuccess: false, message: "Unauthorized to update this profile" };
    }

    // If display name changed, regenerate slug
    if (data.displayName && data.displayName !== provider.displayName) {
      data.slug = await generateUniqueSlug(data.displayName);
    }

    const updatedProvider = await updateProvider(providerId, data);
    
    // Audit log for profile updates
    console.log(`[AUDIT] User ${userId} updated provider profile ${providerId} at ${new Date().toISOString()}`);
    
    revalidatePath("/dashboard/provider");
    revalidatePath("/dashboard/provider/profile");
    revalidatePath(`/providers/${provider.slug}`);
    if (data.slug) {
      revalidatePath(`/providers/${data.slug}`);
    }
    
    return {
      isSuccess: true,
      message: "Profile updated successfully",
      data: updatedProvider,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
    return { isSuccess: false, message: errorMessage };
  }
}

// Set provider availability
export async function setProviderAvailabilityAction(
  providerId: string,
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>
): Promise<ActionResult<ProviderAvailability[]>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" };
    }

    // Verify the provider belongs to the current user
    const provider = await getProviderById(providerId);
    
    if (!provider) {
      return { isSuccess: false, message: "Provider not found" };
    }

    if (provider.userId !== userId) {
      return { isSuccess: false, message: "Unauthorized to update this profile" };
    }

    const updatedAvailability = await setProviderAvailability(providerId, availability);
    
    revalidatePath("/dashboard/provider");
    revalidatePath("/dashboard/provider/profile");
    revalidatePath(`/providers/${provider.slug}`);
    
    return {
      isSuccess: true,
      message: "Availability updated successfully",
      data: updatedAvailability,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update availability";
    return { isSuccess: false, message: errorMessage };
  }
}

// Get available services with counts for filter UI
export async function getAvailableServicesAction(): Promise<
  ActionResult<Array<{ id: string; name: string; count: number }>>
> {
  try {
    const services = await getAvailableServices();
    
    // Convert to format expected by UI
    const servicesWithIds = services.map((service, index) => ({
      id: `service-${index}`,
      name: service.name,
      count: service.count,
    }));
    
    return {
      isSuccess: true,
      message: "Services retrieved successfully",
      data: servicesWithIds,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get services" };
  }
}

// Get location suggestions for autocomplete
export async function getLocationSuggestionsAction(
  type: 'city' | 'state'
): Promise<ActionResult<string[]>> {
  try {
    const suggestions = await getLocationSuggestions(type);
    
    return {
      isSuccess: true,
      message: "Location suggestions retrieved successfully",
      data: suggestions,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get location suggestions" };
  }
}

// Get price range statistics
export async function getPriceRangeStatsAction(): Promise<
  ActionResult<{ min: number; max: number; avg: number }>
> {
  try {
    const stats = await getPriceRangeStats();
    
    return {
      isSuccess: true,
      message: "Price range statistics retrieved successfully",
      data: stats,
    };
  } catch (error) {
    return { isSuccess: false, message: "Failed to get price range statistics" };
  }
}