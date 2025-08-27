import { NextRequest, NextResponse } from "next/server";
import { searchThings } from "@/db/queries/things-queries";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedQuery } from "@/lib/security/api-handler";

/**
 * Things Search API
 * GET /api/things/search - Advanced search with keywords and filters
 */

// Advanced search schema
const searchSchema = z.object({
  // Keywords and text search
  q: z.string().min(2).max(100).optional(), // Main search query
  keywords: z.string().optional(), // Additional keywords
  
  // Category filters
  category: z.enum([
    "electronics",
    "furniture",
    "clothing",
    "tools",
    "sports",
    "books",
    "toys",
    "appliances",
    "automotive",
    "garden",
    "music",
    "art",
    "collectibles",
    "other",
  ]).optional(),
  subcategory: z.string().optional(),
  
  // Condition filters (comma-separated)
  condition: z.string().optional().transform(val => val ? val.split(',').map(c => c.trim()) : undefined),
  
  // Brand and model
  brand: z.string().optional(),
  model: z.string().optional(),
  
  // Price range
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  negotiable: z.coerce.boolean().optional(),
  
  // Location
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  nearMe: z.coerce.boolean().optional(), // Requires lat/lng
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(100).default(25),
  
  // Delivery options
  shippingAvailable: z.coerce.boolean().optional(),
  localPickupOnly: z.coerce.boolean().optional(),
  freeShipping: z.coerce.boolean().optional(),
  
  // Item specifics
  yearMin: z.coerce.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  yearMax: z.coerce.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  hasImages: z.coerce.boolean().optional(),
  hasVideo: z.coerce.boolean().optional(),
  
  // Seller filters
  sellerId: z.string().optional(),
  verifiedSeller: z.coerce.boolean().optional(),
  
  // Status filters
  includeReserved: z.coerce.boolean().default(false),
  includeSold: z.coerce.boolean().default(false),
  
  // Sort and pagination
  sortBy: z.enum(["relevance", "price_low", "price_high", "newest", "oldest", "distance", "popular"]).default("relevance"),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional(),
});

/**
 * GET handler - Advanced search for things
 */
async function handleSearchThings(req: NextRequest) {
  try {
    const query = getValidatedQuery<z.infer<typeof searchSchema>>(req);
    
    if (!query) {
      return createApiError("Invalid search parameters", { status: 400 });
    }
    
    // Convert page to offset if provided
    if (query.page) {
      query.offset = (query.page - 1) * query.limit;
    }
    
    // Build status filter based on include flags
    const statusFilter = ["active"];
    if (query.includeReserved) {
      statusFilter.push("reserved");
    }
    if (query.includeSold) {
      statusFilter.push("sold");
    }
    
    // Map sort options to internal format
    let sortBy: "price" | "created" | "views" | "distance" | "popularity" = "created";
    let sortOrder: "asc" | "desc" = "desc";
    
    switch (query.sortBy) {
      case "price_low":
        sortBy = "price";
        sortOrder = "asc";
        break;
      case "price_high":
        sortBy = "price";
        sortOrder = "desc";
        break;
      case "newest":
        sortBy = "created";
        sortOrder = "desc";
        break;
      case "oldest":
        sortBy = "created";
        sortOrder = "asc";
        break;
      case "distance":
        if (query.latitude && query.longitude) {
          sortBy = "distance";
          sortOrder = "asc";
        }
        break;
      case "popular":
        sortBy = "popularity";
        sortOrder = "desc";
        break;
      case "relevance":
      default:
        // For relevance, we'll use popularity if no search query, otherwise let the DB handle it
        if (!query.q) {
          sortBy = "popularity";
          sortOrder = "desc";
        }
        break;
    }
    
    // Combine search query with keywords
    const searchQuery = [query.q, query.keywords].filter(Boolean).join(' ');
    
    // Search things
    const result = await searchThings({
      query: searchQuery || undefined,
      category: query.category,
      subcategory: query.subcategory,
      condition: query.condition,
      brand: query.brand,
      city: query.city,
      state: query.state,
      zipCode: query.zipCode,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      negotiable: query.negotiable,
      shippingAvailable: query.shippingAvailable || query.freeShipping,
      localPickupOnly: query.localPickupOnly,
      status: statusFilter,
      sellerId: query.sellerId,
      latitude: query.nearMe ? query.latitude : undefined,
      longitude: query.nearMe ? query.longitude : undefined,
      radiusMiles: query.nearMe ? query.radius : undefined,
      sortBy,
      sortOrder,
      limit: query.limit,
      offset: query.offset,
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / query.limit);
    const currentPage = Math.floor(query.offset / query.limit) + 1;
    
    // Transform and filter results
    let transformedThings = result.things.map(thing => ({
      id: thing.id,
      title: thing.title,
      description: thing.description,
      category: thing.category,
      subcategory: thing.subcategory,
      condition: thing.condition,
      brand: thing.brand,
      model: thing.model,
      price: Number(thing.price),
      originalPrice: thing.originalPrice ? Number(thing.originalPrice) : null,
      negotiable: thing.negotiable,
      currency: thing.currency,
      images: thing.images,
      thumbnailUrl: thing.thumbnailUrl,
      videoUrl: thing.videoUrl,
      city: thing.city,
      state: thing.state,
      zipCode: thing.zipCode,
      distance: thing.distance,
      status: thing.status,
      quantity: thing.quantity,
      shippingAvailable: thing.shippingAvailable,
      shippingCost: thing.shippingCost ? Number(thing.shippingCost) : null,
      localPickupOnly: thing.localPickupOnly,
      yearManufactured: thing.yearManufactured,
      viewCount: thing.viewCount,
      favoriteCount: thing.favoriteCount,
      inquiryCount: thing.inquiryCount,
      featured: thing.featured,
      createdAt: thing.createdAt,
      seller: thing.seller,
      relevanceScore: calculateRelevanceScore(thing, query),
    }));
    
    // Apply additional filters not handled by DB query
    if (query.freeShipping) {
      transformedThings = transformedThings.filter(thing => 
        thing.shippingAvailable && thing.shippingCost === 0
      );
    }
    
    if (query.yearMin || query.yearMax) {
      transformedThings = transformedThings.filter(thing => {
        if (!thing.yearManufactured) return false;
        if (query.yearMin && thing.yearManufactured < query.yearMin) return false;
        if (query.yearMax && thing.yearManufactured > query.yearMax) return false;
        return true;
      });
    }
    
    if (query.hasImages) {
      transformedThings = transformedThings.filter(thing => 
        thing.images && thing.images.length > 0
      );
    }
    
    if (query.hasVideo) {
      transformedThings = transformedThings.filter(thing => 
        thing.videoUrl !== null && thing.videoUrl !== undefined
      );
    }
    
    // Sort by relevance if that was requested
    if (query.sortBy === "relevance" && query.q) {
      transformedThings.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    
    return createApiResponse({
      results: transformedThings,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        page: currentPage,
        totalPages,
        hasMore: result.hasMore,
      },
      search: {
        query: query.q,
        keywords: query.keywords,
        filters: {
          category: query.category,
          condition: query.condition,
          priceRange: query.minPrice || query.maxPrice ? {
            min: query.minPrice,
            max: query.maxPrice,
          } : undefined,
          location: query.city || query.state ? {
            city: query.city,
            state: query.state,
            zipCode: query.zipCode,
          } : undefined,
          delivery: {
            shipping: query.shippingAvailable,
            pickup: query.localPickupOnly,
            freeShipping: query.freeShipping,
          },
        },
        sortedBy: query.sortBy,
      },
    });
    
  } catch (error) {
    console.error("Error searching things:", error);
    return createApiError("Search failed", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

/**
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(thing: any, query: any): number {
  let score = 0;
  
  if (!query.q) return score;
  
  const searchTerms = query.q.toLowerCase().split(' ');
  const title = thing.title?.toLowerCase() || '';
  const description = thing.description?.toLowerCase() || '';
  const brand = thing.brand?.toLowerCase() || '';
  const model = thing.model?.toLowerCase() || '';
  
  searchTerms.forEach(term => {
    // Title matches are worth the most
    if (title.includes(term)) score += 10;
    if (title.startsWith(term)) score += 5;
    
    // Brand/model matches are valuable
    if (brand.includes(term)) score += 7;
    if (model.includes(term)) score += 7;
    
    // Description matches
    if (description.includes(term)) score += 3;
  });
  
  // Boost featured items
  if (thing.featured) score += 5;
  
  // Consider popularity
  score += Math.log(thing.viewCount + 1) * 0.5;
  score += thing.favoriteCount * 2;
  score += thing.inquiryCount * 3;
  
  return score;
}

// GET: Public endpoint for searching things
export const GET = createSecureApiHandler(
  handleSearchThings,
  {
    requireAuth: false,
    validateQuery: searchSchema,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}