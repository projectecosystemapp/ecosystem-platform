import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

/**
 * Individual Product Management for Connected Accounts
 * 
 * This endpoint handles CRUD operations for specific products on connected accounts.
 * It demonstrates how to use the Stripe-Account header for individual product operations.
 */

/**
 * GET /api/stripe/connect/accounts/[accountId]/products/[productId]
 * 
 * Retrieves a specific product from a connected account
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { accountId: string; productId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { accountId, productId } = params;

    // Verify account ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider || provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Retrieve the product using Stripe-Account header
    // This ensures we're fetching from the correct connected account
    const product = await stripe.products.retrieve(productId, {}, {
      stripeAccount: accountId
    });

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        default_price: product.default_price,
        active: product.active,
        created: product.created,
        updated: product.updated,
        account_id: accountId
      }
    });

  } catch (error) {
    console.error("Error retrieving product:", error);
    
    if (error instanceof Error && error.message.includes("No such product")) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to retrieve product" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/stripe/connect/accounts/[accountId]/products/[productId]
 * Body: { name?: string, description?: string, active?: boolean, images?: string[] }
 * 
 * Updates a specific product on a connected account
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { accountId: string; productId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { accountId, productId } = params;
    const body = await req.json();
    const { name, description, active, images } = body;

    // Verify account ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider || provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Prepare update data (only include defined fields)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (active !== undefined) updateData.active = active;
    if (images !== undefined) updateData.images = images;

    // Update the product using Stripe-Account header
    const updatedProduct = await stripe.products.update(productId, updateData, {
      stripeAccount: accountId
    });

    return NextResponse.json({
      success: true,
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        description: updatedProduct.description,
        images: updatedProduct.images,
        default_price: updatedProduct.default_price,
        active: updatedProduct.active,
        created: updatedProduct.created,
        updated: updatedProduct.updated,
        account_id: accountId
      },
      message: "Product updated successfully"
    });

  } catch (error) {
    console.error("Error updating product:", error);
    
    if (error instanceof Error && error.message.includes("No such product")) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stripe/connect/accounts/[accountId]/products/[productId]
 * 
 * Deletes (deactivates) a specific product on a connected account
 * Note: Stripe doesn't actually delete products, it deactivates them
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { accountId: string; productId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { accountId, productId } = params;

    // Verify account ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider || provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Deactivate the product (Stripe doesn't support true deletion)
    const deletedProduct = await stripe.products.update(productId, {
      active: false
    }, {
      stripeAccount: accountId
    });

    return NextResponse.json({
      success: true,
      product: {
        id: deletedProduct.id,
        active: deletedProduct.active
      },
      message: "Product deactivated successfully"
    });

  } catch (error) {
    console.error("Error deleting product:", error);
    
    if (error instanceof Error && error.message.includes("No such product")) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

/**
 * Usage Examples:
 * 
 * GET /api/stripe/connect/accounts/acct_1234567890/products/prod_abc123
 * 
 * Response:
 * {
 *   "success": true,
 *   "product": {
 *     "id": "prod_abc123",
 *     "name": "Photography Session",
 *     "description": "Professional portrait session",
 *     "images": ["https://..."],
 *     "default_price": { "id": "price_def456", "unit_amount": 15000 },
 *     "active": true,
 *     "created": 1640995200,
 *     "updated": 1640995200,
 *     "account_id": "acct_1234567890"
 *   }
 * }
 * 
 * PUT /api/stripe/connect/accounts/acct_1234567890/products/prod_abc123
 * {
 *   "name": "Updated Photography Session",
 *   "description": "Premium portrait photography session",
 *   "active": true
 * }
 * 
 * DELETE /api/stripe/connect/accounts/acct_1234567890/products/prod_abc123
 * 
 * Response:
 * {
 *   "success": true,
 *   "product": { "id": "prod_abc123", "active": false },
 *   "message": "Product deactivated successfully"
 * }
 */