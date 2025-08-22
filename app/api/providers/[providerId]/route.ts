import { NextRequest, NextResponse } from "next/server";
import { getProviderById, getProviderBySlug } from "@/db/queries/providers-queries";
import { auth } from "@clerk/nextjs/server";

/**
 * Individual Provider API
 * GET /api/providers/[providerId] - Get provider details by ID or slug
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { providerId } = params;
    
    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }
    
    try {
      // Try to get provider by ID first, then by slug
      let provider = await getProviderById(providerId);
      
      if (!provider) {
        provider = await getProviderBySlug(providerId);
      }
      
      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        );
      }
      
      // Check if provider is active
      if (!provider.isActive) {
        return NextResponse.json(
          { error: "Provider is not available" },
          { status: 404 }
        );
      }
      
      // Transform provider for frontend consumption
      const transformedProvider = {
        id: provider.id,
        userId: provider.userId,
        displayName: provider.displayName,
        slug: provider.slug,
        tagline: provider.tagline,
        bio: provider.bio,
        profileImageUrl: provider.profileImageUrl,
        coverImageUrl: provider.coverImageUrl,
        locationCity: provider.locationCity,
        locationState: provider.locationState,
        locationCountry: provider.locationCountry,
        hourlyRate: provider.hourlyRate,
        currency: provider.currency,
        averageRating: parseFloat(provider.averageRating?.toString() || "0"),
        totalReviews: provider.totalReviews,
        completedBookings: provider.completedBookings,
        isVerified: provider.isVerified,
        isActive: provider.isActive,
        services: provider.services,
        // portfolio: provider.portfolio, // Field doesn't exist in schema yet
        // socialLinks: provider.socialLinks, // Field doesn't exist in schema yet
        commissionRate: provider.commissionRate,
        // Show Stripe status for booking availability
        stripeOnboardingComplete: provider.stripeOnboardingComplete,
        // Don't expose sensitive Stripe account ID
        stripeConnectAccountId: undefined,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      };
      
      return NextResponse.json({
        provider: transformedProvider,
      });
      
    } catch (dbError) {
      console.error("Database error fetching provider:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch provider details" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in provider details API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update provider details (authenticated provider only)
 * PATCH /api/providers/[providerId] - Update provider profile
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const { providerId } = params;
    
    // Get the provider to verify ownership
    const provider = await getProviderById(providerId);
    
    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }
    
    // Verify the authenticated user owns this provider profile
    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to update this provider" },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    
    // Validate and sanitize update data
    const allowedFields = [
      'displayName',
      'tagline', 
      'bio',
      'profileImageUrl',
      'coverImageUrl',
      'locationCity',
      'locationState',
      'locationCountry',
      'hourlyRate',
      'currency',
      'services',
      // 'portfolio', // Field doesn't exist in schema yet
      // 'socialLinks', // Field doesn't exist in schema yet
    ];
    
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }
    
    try {
      // Import here to avoid circular dependencies
      const { updateProvider } = await import("@/db/queries/providers-queries");
      
      const updatedProvider = await updateProvider(providerId, updateData);
      
      // Transform for response
      const transformedProvider = {
        id: updatedProvider.id,
        displayName: updatedProvider.displayName,
        slug: updatedProvider.slug,
        tagline: updatedProvider.tagline,
        bio: updatedProvider.bio,
        profileImageUrl: updatedProvider.profileImageUrl,
        coverImageUrl: updatedProvider.coverImageUrl,
        locationCity: updatedProvider.locationCity,
        locationState: updatedProvider.locationState,
        locationCountry: updatedProvider.locationCountry,
        hourlyRate: updatedProvider.hourlyRate,
        currency: updatedProvider.currency,
        services: updatedProvider.services,
        // portfolio: updatedProvider.portfolio, // Field doesn't exist in schema yet
        // socialLinks: updatedProvider.socialLinks, // Field doesn't exist in schema yet
        updatedAt: updatedProvider.updatedAt,
      };
      
      return NextResponse.json({
        provider: transformedProvider,
        message: "Provider updated successfully",
      });
      
    } catch (dbError) {
      console.error("Database error updating provider:", dbError);
      return NextResponse.json(
        { error: "Failed to update provider" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in provider update API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}