import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { categoriesTable } from "@/db/schema/categories-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { ApiResponse, withErrorHandler } from "@/lib/api-response";

// Category creation schema (admin only)
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().default(0),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  imageUrl: z.string().url().optional(),
  isFeatured: z.boolean().default(false),
  metadata: z.object({
    keywords: z.array(z.string()).optional(),
    averagePrice: z.number().optional(),
    popularServices: z.array(z.string()).optional(),
  }).optional(),
});

// Category update schema
const updateCategorySchema = createCategorySchema.partial();

/**
 * GET /api/categories - Get all categories with hierarchy
 */
export async function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId");
    const featured = searchParams.get("featured") === "true";
    const withStats = searchParams.get("withStats") === "true";
    
    // Build query conditions
    const conditions = [eq(categoriesTable.isActive, true)];
    
    if (parentId === "root") {
      conditions.push(isNull(categoriesTable.parentId));
    } else if (parentId) {
      conditions.push(eq(categoriesTable.parentId, parentId));
    }
    
    if (featured) {
      conditions.push(eq(categoriesTable.isFeatured, true));
    }
    
    // Get categories
    let categories = await db
      .select()
      .from(categoriesTable)
      .where(and(...conditions))
      .orderBy(categoriesTable.sortOrder, categoriesTable.name);
    
    // If withStats is requested, get service counts for each category
    if (withStats) {
      const categoriesWithStats = await Promise.all(
        categories.map(async (category) => {
          const [stats] = await db
            .select({
              serviceCount: sql<number>`count(*)::int`,
              avgPrice: sql<number>`avg(CAST(base_price AS numeric))::numeric(10,2)`,
            })
            .from(servicesTable)
            .where(
              and(
                eq(servicesTable.category, category.name),
                eq(servicesTable.isActive, true)
              )
            );
          
          return {
            ...category,
            stats: {
              serviceCount: stats.serviceCount ?? 0,
              averagePrice: stats.avgPrice ?? 0,
            },
          };
        })
      );
      
      categories = categoriesWithStats;
    }
    
    // Build hierarchy if no specific parent requested
    if (!parentId) {
      const categoryMap = new Map(categories.map(cat => [cat.id, cat]));
      const rootCategories: any[] = [];
      
      categories.forEach(category => {
        const categoryWithChildren = { ...category, children: [] as any[] };
        
        if (!category.parentId) {
          rootCategories.push(categoryWithChildren);
        } else {
          const parent = categoryMap.get(category.parentId);
          if (parent) {
            if (!parent.children) {
              (parent as any).children = [];
            }
            (parent as any).children.push(categoryWithChildren);
          }
        }
      });
      
      return ApiResponse.success(rootCategories);
    }
    
    return ApiResponse.success(categories);
  });
}

/**
 * POST /api/categories - Create a new category (admin only)
 */
export async function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    // TODO: Add admin check here
    // For now, we'll just check if user is authenticated
    
    const body = await req.json();
    const validatedData = createCategorySchema.parse(body);
    
    // Check if slug already exists
    const [existingCategory] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, validatedData.slug));
    
    if (existingCategory) {
      return ApiResponse.conflict("Category with this slug already exists");
    }
    
    // Calculate level based on parent
    let level = 0;
    if (validatedData.parentId) {
      const [parent] = await db
        .select({ level: categoriesTable.level })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, validatedData.parentId));
      
      if (!parent) {
        return ApiResponse.notFound("Parent category");
      }
      
      level = parent.level + 1;
    }
    
    // Create the category
    const [category] = await db
      .insert(categoriesTable)
      .values({
        ...validatedData,
        level,
      })
      .returning();
    
    return ApiResponse.created(category, "Category created successfully");
  });
}

/**
 * PATCH /api/categories - Update a category (admin only)
 */
export async function PATCH(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    // TODO: Add admin check here
    
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("id");
    
    if (!categoryId) {
      return ApiResponse.validationError({ id: "Category ID is required" });
    }
    
    const body = await req.json();
    const validatedData = updateCategorySchema.parse(body);
    
    // Check if category exists
    const [existingCategory] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId));
    
    if (!existingCategory) {
      return ApiResponse.notFound("Category");
    }
    
    // If slug is being updated, check for uniqueness
    if (validatedData.slug && validatedData.slug !== existingCategory.slug) {
      const [duplicateCategory] = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(eq(categoriesTable.slug, validatedData.slug));
      
      if (duplicateCategory) {
        return ApiResponse.conflict("Category with this slug already exists");
      }
    }
    
    // Update level if parent is changed
    let updateData: any = { ...validatedData, updatedAt: new Date() };
    
    if (validatedData.parentId !== undefined && validatedData.parentId !== existingCategory.parentId) {
      if (validatedData.parentId === null) {
        updateData.level = 0;
      } else {
        const [parent] = await db
          .select({ level: categoriesTable.level })
          .from(categoriesTable)
          .where(eq(categoriesTable.id, validatedData.parentId));
        
        if (!parent) {
          return ApiResponse.notFound("Parent category");
        }
        
        updateData.level = parent.level + 1;
      }
    }
    
    // Update the category
    const [updatedCategory] = await db
      .update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, categoryId))
      .returning();
    
    return ApiResponse.success(updatedCategory, "Category updated successfully");
  });
}

/**
 * DELETE /api/categories - Delete a category (admin only)
 */
export async function DELETE(req: NextRequest) {
  return withErrorHandler(async () => {
    const { userId } = await auth();
    if (!userId) {
      return ApiResponse.unauthorized();
    }
    
    // TODO: Add admin check here
    
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("id");
    
    if (!categoryId) {
      return ApiResponse.validationError({ id: "Category ID is required" });
    }
    
    // Check if category has children
    const [childCategory] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.parentId, categoryId))
      .limit(1);
    
    if (childCategory) {
      return ApiResponse.conflict("Cannot delete category with child categories");
    }
    
    // Check if category has services
    const [service] = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(eq(servicesTable.category, categoryId))
      .limit(1);
    
    if (service) {
      return ApiResponse.conflict("Cannot delete category with associated services");
    }
    
    // Soft delete by setting isActive to false
    await db
      .update(categoriesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(categoriesTable.id, categoryId));
    
    return ApiResponse.noContent();
  });
}