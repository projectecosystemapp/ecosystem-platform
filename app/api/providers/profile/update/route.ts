// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateProvider, getProviderById } from "@/db/queries/providers-queries";
import { z } from "zod";

// Request body schema
const updateProfileSchema = z.object({
  providerId: z.string().uuid(),
  data: z.object({
    displayName: z.string().min(2).max(100).optional(),
    tagline: z.string().max(150).optional().nullable(),
    bio: z.string().max(1000).optional().nullable(),
    coverImageUrl: z.string().url().optional().nullable(),
    profileImageUrl: z.string().url().optional().nullable(),
    galleryImages: z.array(z.string().url()).optional(),
    locationCity: z.string().max(100).optional().nullable(),
    locationState: z.string().max(100).optional().nullable(),
    locationCountry: z.string().optional(),
    hourlyRate: z.string().optional().nullable(),
    services: z.array(z.object({
      name: z.string().min(2).max(100),
      description: z.string().min(10).max(500),
      duration: z.number().int().min(15).max(480),
      price: z.number().min(0).max(10000),
    })).optional(),
    yearsExperience: z.number().int().min(0).max(100).optional().nullable(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { providerId, data } = validation.data;

    // Verify the provider belongs to the current user
    const provider = await getProviderById(providerId);
    
    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to update this profile" },
        { status: 403 }
      );
    }

    // Update the provider profile
    const updatedProvider = await updateProvider(providerId, {
      ...data,
      updatedAt: new Date(),
    });

    return NextResponse.json(
      { 
        success: true,
        data: updatedProvider,
        message: "Profile updated successfully" 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error updating provider profile:", error);
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}