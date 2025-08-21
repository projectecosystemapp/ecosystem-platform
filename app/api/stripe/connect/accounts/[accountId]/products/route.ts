import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createConnectedAccountProduct, listConnectedAccountProducts } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Product Management for Connected Accounts
 * 
 * This endpoint demonstrates how to manage products on connected accounts
 * using the Stripe-Account header. This allows each provider to have their
 * own products while maintaining marketplace control.
 * 
 * Key concepts:
 * - Products are created directly on the connected account
 * - The Stripe-Account header specifies which account to operate on
 * - Pricing and product details are controlled by the provider
 * - The marketplace can still apply application fees during checkout
 */

/**
 * GET /api/stripe/connect/accounts/[accountId]/products
 * 
 * Lists all products for a connected account
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    // Authenticate the user making the request
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { accountId } = params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    // Verify account ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // List products using the Stripe-Account header
    // This fetches products that belong specifically to this connected account
    const products = await listConnectedAccountProducts(accountId, limit);

    return NextResponse.json({
      success: true,
      products: products.data.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        default_price: product.default_price,
        active: product.active,
        created: product.created,
        updated: product.updated
      })),
      pagination: {
        has_more: products.has_more,
        total_count: products.data.length
      }
    });

  } catch (error) {
    console.error("Error listing products:", error);
    return NextResponse.json(
      { error: "Failed to list products" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stripe/connect/accounts/[accountId]/products
 * Body: { name: string, description?: string, priceInCents: number, currency?: string, images?: string[] }
 * 
 * Creates a new product on the connected account
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    // Authenticate the user making the request
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { accountId } = params;

    // Parse and validate request body
    const body = await req.json();
    const { 
      name, 
      description, 
      priceInCents, 
      currency = "usd", 
      images = [] 
    } = body;

    // Validate required fields
    if (!name || !priceInCents) {
      return NextResponse.json(
        { error: "Product name and price are required" },
        { status: 400 }
      );
    }

    if (priceInCents < 50) {
      return NextResponse.json(
        { error: "Price must be at least $0.50 (50 cents)" },
        { status: 400 }
      );
    }

    // Verify account ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Create product on the connected account using Stripe-Account header
    // This is the key difference from standard Stripe integration:
    // The product is created directly on the provider's account
    const product = await createConnectedAccountProduct({
      accountId,
      name,
      description,
      priceInCents,
      currency,
      images
    });

    // Return the created product details
    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        default_price: product.default_price,
        active: product.active,
        account_id: accountId
      },
      message: "Product created successfully on connected account"
    });

  } catch (error) {
    console.error("Error creating product:", error);
    
    if (error instanceof Error) {
      // Handle specific Stripe errors
      if (error.message.includes("No such account")) {
        return NextResponse.json(
          { error: "Connected account not found in Stripe" },
          { status: 404 }
        );
      }
      
      if (error.message.includes("not activated")) {
        return NextResponse.json(
          { error: "Connected account must complete onboarding before creating products" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "Failed to create product",
          details: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Usage Examples:
 * 
 * GET /api/stripe/connect/accounts/acct_1234567890/products?limit=10
 * 
 * Response:
 * {
 *   "success": true,
 *   "products": [
 *     {
 *       "id": "prod_abc123",
 *       "name": "1-Hour Photography Session",
 *       "description": "Professional portrait photography session",
 *       "images": ["https://..."],
 *       "default_price": "price_def456",
 *       "active": true,
 *       "created": 1640995200,
 *       "updated": 1640995200
 *     }
 *   ],
 *   "pagination": { "has_more": false, "total_count": 1 }
 * }
 * 
 * POST /api/stripe/connect/accounts/acct_1234567890/products
 * {
 *   "name": "2-Hour Wedding Photography",
 *   "description": "Complete wedding photography package",
 *   "priceInCents": 50000,
 *   "currency": "usd",
 *   "images": ["https://example.com/wedding-photo.jpg"]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "product": {
 *     "id": "prod_xyz789",
 *     "name": "2-Hour Wedding Photography",
 *     "description": "Complete wedding photography package",
 *     "images": ["https://example.com/wedding-photo.jpg"],
 *     "default_price": "price_ghi012",
 *     "active": true,
 *     "account_id": "acct_1234567890"
 *   },
 *   "message": "Product created successfully on connected account"
 * }
 */