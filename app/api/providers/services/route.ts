/**
 * Provider Services Management API
 * Allows providers to create and manage services/products on their Stripe accounts
 * 
 * This enables providers to:
 * 1. Create services with pricing that customers can book
 * 2. Update service details and pricing
 * 3. Manage service availability
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/db/db';
import { providersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Service creation schema
const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  priceInCents: z.number().positive().int(),
  currency: z.string().default('usd'),
  duration: z.number().positive().int(), // Duration in minutes
  images: z.array(z.string()).optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.string()).optional(),
});

// Service update schema
const updateServiceSchema = createServiceSchema.partial().extend({
  serviceId: z.string(),
});

/**
 * POST /api/providers/services
 * Create a new service/product on the provider's Stripe account
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get provider profile
    const [provider] = await db
      .select({
        id: providersTable.id,
        stripeAccountId: providersTable.stripeConnectAccountId,
        displayName: providersTable.displayName,
        stripeOnboardingComplete: providersTable.stripeOnboardingComplete,
        services: providersTable.services,
      })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider profile not found' },
        { status: 404 }
      );
    }

    if (!provider.stripeAccountId || !provider.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: 'Please complete payment setup before creating services' },
        { status: 400 }
      );
    }

    // Parse and validate request
    const body = await req.json();
    const parseResult = createServiceSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid service data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const serviceData = parseResult.data;

    // Create product on Stripe Connect account
    const product = await stripe.products.create({
      name: serviceData.name,
      description: serviceData.description,
      images: serviceData.images,
      active: serviceData.active,
      metadata: {
        ...serviceData.metadata,
        providerId: provider.id,
        duration: String(serviceData.duration),
        platform: 'ecosystem_marketplace',
      },
      default_price_data: {
        currency: serviceData.currency,
        unit_amount: serviceData.priceInCents,
      },
    }, {
      stripeAccount: provider.stripeAccountId, // Create on connected account
    });

    // Update provider's services in database
    const currentServices = (provider.services as any[]) || [];
    const newService = {
      id: product.id,
      name: serviceData.name,
      description: serviceData.description,
      price: serviceData.priceInCents / 100, // Store in dollars
      duration: serviceData.duration,
      currency: serviceData.currency,
      active: serviceData.active,
      stripeProductId: product.id,
      stripePriceId: product.default_price as string,
      createdAt: new Date().toISOString(),
    };

    await db
      .update(providersTable)
      .set({
        services: [...currentServices, newService] as any,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, provider.id));

    console.log(`Created service ${product.id} for provider ${provider.id}`);

    return NextResponse.json({
      success: true,
      service: newService,
      stripeProduct: {
        id: product.id,
        priceId: product.default_price,
      },
    });

  } catch (error) {
    console.error('Error creating service:', error);
    
    if (error instanceof Error && error.message.includes('Stripe')) {
      return NextResponse.json(
        { error: 'Failed to create service on payment platform', details: error.message },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/providers/services
 * List all services for the authenticated provider
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get provider profile with services
    const [provider] = await db
      .select({
        id: providersTable.id,
        stripeAccountId: providersTable.stripeConnectAccountId,
        services: providersTable.services,
      })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider profile not found' },
        { status: 404 }
      );
    }

    const services = (provider.services as any[]) || [];

    // If provider has Stripe account, sync with Stripe products
    if (provider.stripeAccountId) {
      try {
        const stripeProducts = await stripe.products.list(
          { limit: 100, active: true },
          { stripeAccount: provider.stripeAccountId }
        );

        // Merge Stripe data with local services
        const mergedServices = services.map(service => {
          const stripeProduct = stripeProducts.data.find(p => p.id === service.stripeProductId);
          if (stripeProduct) {
            return {
              ...service,
              stripeActive: stripeProduct.active,
              stripeName: stripeProduct.name,
              stripeDescription: stripeProduct.description,
            };
          }
          return service;
        });

        return NextResponse.json({
          services: mergedServices,
          count: mergedServices.length,
        });
      } catch (stripeError) {
        console.error('Error fetching Stripe products:', stripeError);
        // Fall back to local data
      }
    }

    return NextResponse.json({
      services,
      count: services.length,
    });

  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/providers/services
 * Update an existing service
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request
    const body = await req.json();
    const parseResult = updateServiceSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { serviceId, ...updateData } = parseResult.data;

    // Get provider
    const [provider] = await db
      .select({
        id: providersTable.id,
        stripeAccountId: providersTable.stripeConnectAccountId,
        services: providersTable.services,
      })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);

    if (!provider || !provider.stripeAccountId) {
      return NextResponse.json(
        { error: 'Provider not found or payment not configured' },
        { status: 404 }
      );
    }

    // Find the service in provider's services
    const services = (provider.services as any[]) || [];
    const serviceIndex = services.findIndex(s => s.id === serviceId || s.stripeProductId === serviceId);
    
    if (serviceIndex === -1) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    const service = services[serviceIndex];

    // Update on Stripe
    const stripeUpdates: any = {};
    if (updateData.name) stripeUpdates.name = updateData.name;
    if (updateData.description) stripeUpdates.description = updateData.description;
    if (updateData.images) stripeUpdates.images = updateData.images;
    if (updateData.active !== undefined) stripeUpdates.active = updateData.active;
    if (updateData.metadata) {
      stripeUpdates.metadata = {
        ...service.metadata,
        ...updateData.metadata,
      };
    }

    await stripe.products.update(
      service.stripeProductId,
      stripeUpdates,
      { stripeAccount: provider.stripeAccountId }
    );

    // Update price if changed
    if (updateData.priceInCents && updateData.priceInCents !== service.price * 100) {
      // Create new price (prices are immutable in Stripe)
      const newPrice = await stripe.prices.create({
        product: service.stripeProductId,
        currency: updateData.currency || service.currency || 'usd',
        unit_amount: updateData.priceInCents,
      }, {
        stripeAccount: provider.stripeAccountId,
      });

      // Update default price on product
      await stripe.products.update(
        service.stripeProductId,
        { default_price: newPrice.id },
        { stripeAccount: provider.stripeAccountId }
      );

      service.stripePriceId = newPrice.id;
      service.price = updateData.priceInCents / 100;
    }

    // Update local service data
    Object.assign(service, {
      name: updateData.name || service.name,
      description: updateData.description || service.description,
      duration: updateData.duration || service.duration,
      active: updateData.active !== undefined ? updateData.active : service.active,
      updatedAt: new Date().toISOString(),
    });

    services[serviceIndex] = service;

    // Save to database
    await db
      .update(providersTable)
      .set({
        services: services as any,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, provider.id));

    return NextResponse.json({
      success: true,
      service,
    });

  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/providers/services/:id
 * Deactivate a service (soft delete)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get('id');
    
    if (!serviceId) {
      return NextResponse.json(
        { error: 'Service ID required' },
        { status: 400 }
      );
    }

    // Get provider
    const [provider] = await db
      .select({
        id: providersTable.id,
        stripeAccountId: providersTable.stripeConnectAccountId,
        services: providersTable.services,
      })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);

    if (!provider || !provider.stripeAccountId) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Find and deactivate service
    const services = (provider.services as any[]) || [];
    const serviceIndex = services.findIndex(s => s.id === serviceId || s.stripeProductId === serviceId);
    
    if (serviceIndex === -1) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Deactivate on Stripe (soft delete)
    await stripe.products.update(
      services[serviceIndex].stripeProductId,
      { active: false },
      { stripeAccount: provider.stripeAccountId }
    );

    // Mark as inactive locally
    services[serviceIndex].active = false;
    services[serviceIndex].deletedAt = new Date().toISOString();

    // Save to database
    await db
      .update(providersTable)
      .set({
        services: services as any,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, provider.id));

    return NextResponse.json({
      success: true,
      message: 'Service deactivated successfully',
    });

  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}