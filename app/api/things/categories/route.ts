import { NextRequest, NextResponse } from "next/server";
import { getCategoryCounts } from "@/db/queries/things-queries";
import { createSecureApiHandler, createApiResponse, createApiError } from "@/lib/security/api-handler";

/**
 * Things Categories API
 * GET /api/things/categories - Get categories and counts
 */

// Category metadata
const CATEGORY_INFO = {
  electronics: {
    name: "Electronics",
    icon: "💻",
    description: "Phones, computers, gaming, audio & more",
    subcategories: [
      "Smartphones",
      "Laptops",
      "Tablets",
      "Gaming Consoles",
      "Audio Equipment",
      "Cameras",
      "Smart Home",
      "Accessories",
    ],
  },
  furniture: {
    name: "Furniture",
    icon: "🛋️",
    description: "Home & office furniture",
    subcategories: [
      "Living Room",
      "Bedroom",
      "Dining Room",
      "Office",
      "Outdoor",
      "Storage",
      "Decor",
    ],
  },
  clothing: {
    name: "Clothing & Accessories",
    icon: "👔",
    description: "Fashion for all",
    subcategories: [
      "Men's Clothing",
      "Women's Clothing",
      "Kids' Clothing",
      "Shoes",
      "Bags",
      "Jewelry",
      "Watches",
      "Accessories",
    ],
  },
  tools: {
    name: "Tools & Equipment",
    icon: "🔧",
    description: "Hand tools, power tools & equipment",
    subcategories: [
      "Hand Tools",
      "Power Tools",
      "Garden Tools",
      "Construction",
      "Automotive Tools",
      "Workshop Equipment",
    ],
  },
  sports: {
    name: "Sports & Outdoors",
    icon: "⚽",
    description: "Sports equipment & outdoor gear",
    subcategories: [
      "Exercise Equipment",
      "Team Sports",
      "Outdoor Recreation",
      "Camping & Hiking",
      "Water Sports",
      "Winter Sports",
      "Bikes",
    ],
  },
  books: {
    name: "Books & Media",
    icon: "📚",
    description: "Books, movies, music & games",
    subcategories: [
      "Fiction",
      "Non-Fiction",
      "Textbooks",
      "Comics & Manga",
      "Movies & TV",
      "Music",
      "Video Games",
    ],
  },
  toys: {
    name: "Toys & Games",
    icon: "🧸",
    description: "Toys, games & hobbies",
    subcategories: [
      "Action Figures",
      "Dolls",
      "Building Toys",
      "Board Games",
      "Puzzles",
      "Educational Toys",
      "Outdoor Toys",
    ],
  },
  appliances: {
    name: "Home Appliances",
    icon: "🏠",
    description: "Kitchen & home appliances",
    subcategories: [
      "Kitchen Appliances",
      "Laundry",
      "Cleaning",
      "Heating & Cooling",
      "Small Appliances",
    ],
  },
  automotive: {
    name: "Automotive",
    icon: "🚗",
    description: "Auto parts & accessories",
    subcategories: [
      "Parts",
      "Accessories",
      "Tires & Wheels",
      "Electronics",
      "Tools & Equipment",
      "Motorcycles",
    ],
  },
  garden: {
    name: "Garden & Patio",
    icon: "🌿",
    description: "Garden supplies & outdoor living",
    subcategories: [
      "Plants",
      "Garden Tools",
      "Outdoor Furniture",
      "Grills & BBQ",
      "Pools & Spas",
      "Landscaping",
    ],
  },
  music: {
    name: "Musical Instruments",
    icon: "🎸",
    description: "Instruments & music equipment",
    subcategories: [
      "Guitars",
      "Keyboards & Pianos",
      "Drums",
      "Wind Instruments",
      "DJ Equipment",
      "Recording Equipment",
      "Accessories",
    ],
  },
  art: {
    name: "Art & Crafts",
    icon: "🎨",
    description: "Art supplies & handmade items",
    subcategories: [
      "Paintings",
      "Sculptures",
      "Crafts",
      "Art Supplies",
      "Photography",
      "Handmade Items",
    ],
  },
  collectibles: {
    name: "Collectibles & Antiques",
    icon: "🏺",
    description: "Rare finds & vintage items",
    subcategories: [
      "Coins & Currency",
      "Stamps",
      "Trading Cards",
      "Vintage Items",
      "Memorabilia",
      "Antiques",
    ],
  },
  other: {
    name: "Other",
    icon: "📦",
    description: "Everything else",
    subcategories: [
      "Pet Supplies",
      "Baby & Kids",
      "Health & Beauty",
      "Office Supplies",
      "Industrial",
      "Miscellaneous",
    ],
  },
};

/**
 * GET handler - Get categories with counts
 */
async function handleGetCategories(req: NextRequest) {
  try {
    // Get category counts from database
    const counts = await getCategoryCounts();
    
    // Build response with category info and counts
    const categories = Object.entries(CATEGORY_INFO).map(([key, info]) => ({
      id: key,
      name: info.name,
      icon: info.icon,
      description: info.description,
      subcategories: info.subcategories,
      count: counts[key] || 0,
      slug: key,
    }));
    
    // Sort by count (descending) but keep "other" at the end
    categories.sort((a, b) => {
      if (a.id === "other") return 1;
      if (b.id === "other") return -1;
      return b.count - a.count;
    });
    
    // Calculate totals
    const totalListings = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const activeCategories = categories.filter(cat => cat.count > 0).length;
    
    // Get popular categories (top 5 with items)
    const popularCategories = categories
      .filter(cat => cat.count > 0 && cat.id !== "other")
      .slice(0, 5)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        count: cat.count,
      }));
    
    return createApiResponse({
      categories,
      popularCategories,
      statistics: {
        totalListings,
        activeCategories,
        totalCategories: categories.length,
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error("Error getting categories:", error);
    return createApiError("Failed to get categories", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// GET: Public endpoint for categories
export const GET = createSecureApiHandler(
  handleGetCategories,
  {
    requireAuth: false,
    rateLimit: { requests: 100, window: '1m' },
    auditLog: false,
    allowedMethods: ['GET']
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}