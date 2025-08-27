// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/mapbox/server';
import { rateLimit, getRateLimitHeaders } from '@/lib/security/rate-limiter';

const MAX_ADDRESS_LENGTH = 200;
const SUSPICIOUS_PATTERNS = [
  /script/i,
  /<|>/,
  /javascript:/i,
  /vbscript:/i,
  /onload|onerror|onclick/i,
];

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'mapbox');
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult, {
      windowMs: 60 * 1000,
      maxRequests: 30,
      message: 'Too many geocoding requests',
    });
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error,
          retryAfter: 60,
        },
        { 
          status: 429,
          headers: {
            ...rateLimitHeaders,
            'Retry-After': '60',
          }
        }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    // Input validation
    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { 
          status: 400,
          headers: rateLimitHeaders,
        }
      );
    }
    
    if (address.length > MAX_ADDRESS_LENGTH) {
      return NextResponse.json(
        { error: 'Address too long' },
        { 
          status: 400,
          headers: rateLimitHeaders,
        }
      );
    }
    
    // Security checks
    if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(address))) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { 
          status: 400,
          headers: rateLimitHeaders,
        }
      );
    }
    
    // Bot detection
    const userAgent = request.headers.get('user-agent') || '';
    if (isBot(userAgent)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { 
          status: 403,
          headers: rateLimitHeaders,
        }
      );
    }
    
    // Referrer check for additional security
    const referer = request.headers.get('referer');
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    if (!isValidOrigin(referer, origin, host)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { 
          status: 403,
          headers: rateLimitHeaders,
        }
      );
    }
    
    // Sanitize input
    const sanitizedAddress = address.trim();

    // Optional parameters
    const country = searchParams.get('country') || 'us';
    const proximityLat = searchParams.get('proximity_lat');
    const proximityLng = searchParams.get('proximity_lng');
    const types = searchParams.get('types')?.split(',');

    const options: any = { country };
    
    if (proximityLat && proximityLng) {
      options.proximity = {
        lat: parseFloat(proximityLat),
        lng: parseFloat(proximityLng),
      };
    }

    if (types && types.length > 0) {
      options.types = types;
    }

    const results = await geocodeAddress(sanitizedAddress, options);

    // Transform results for client
    const transformedResults = results.map(result => ({
      id: result.id,
      name: result.text,
      fullName: result.place_name,
      coordinates: {
        lat: result.center[1],
        lng: result.center[0],
      },
      accuracy: result.properties?.accuracy || 'unknown',
      relevance: result.relevance,
      placeTypes: result.place_type,
    }));

    return NextResponse.json({
      results: transformedResults,
      query: sanitizedAddress,
    }, {
      headers: {
        ...rateLimitHeaders,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'private, max-age=300',
      },
    });

  } catch (error) {
    console.error('Geocoding API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Service temporarily unavailable',
        code: 'INTERNAL_ERROR',
      },
      { 
        status: 500,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        }
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for batch requests (stricter)
    const rateLimitResult = await rateLimit(request, 'mapbox');
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult, {
      windowMs: 60 * 1000,
      maxRequests: 10, // Lower limit for batch requests
      message: 'Too many batch geocoding requests',
    });
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitHeaders
        }
      );
    }
    
    const body = await request.json();
    const { addresses } = body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'Addresses array is required' },
        { 
          status: 400,
          headers: rateLimitHeaders,
        }
      );
    }

    if (addresses.length > 5) { // Reduced from 10 for security
      return NextResponse.json(
        { error: 'Maximum 5 addresses allowed per request' },
        { 
          status: 400,
          headers: rateLimitHeaders,
        }
      );
    }
    
    // Validate each address
    for (const addressData of addresses) {
      if (!addressData.address || addressData.address.length > MAX_ADDRESS_LENGTH) {
        return NextResponse.json(
          { error: 'Invalid address data' },
          { 
            status: 400,
            headers: rateLimitHeaders,
          }
        );
      }
    }

    // Batch geocoding
    const results = await Promise.allSettled(
      addresses.map(async (addressData: any) => {
        const { address, country, proximity, types } = addressData;
        
        const options: any = { country: country || 'us' };
        if (proximity) options.proximity = proximity;
        if (types) options.types = types;
        
        const geocodeResults = await geocodeAddress(address, options);
        return {
          address,
          results: geocodeResults.map(result => ({
            id: result.id,
            name: result.text,
            fullName: result.place_name,
            coordinates: {
              lat: result.center[1],
              lng: result.center[0],
            },
            accuracy: result.properties?.accuracy || 'unknown',
            relevance: result.relevance,
            placeTypes: result.place_type,
          })),
        };
      })
    );

    const successResults = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason?.message || 'Unknown error');

    return NextResponse.json({
      results: successResults,
      errors: errors.length > 0 ? errors : undefined,
    }, {
      headers: rateLimitHeaders,
    });

  } catch (error) {
    console.error('Batch geocoding error:', error);
    return NextResponse.json(
      { error: 'Batch geocoding failed' },
      { 
        status: 500,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        }
      }
    );
  }
}

// Helper functions
function isBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /nodejs/i,
    /postman/i,
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

function isValidOrigin(referer: string | null, origin: string | null, host: string | null): boolean {
  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
      return true;
    }
  }
  
  // Check if request is from our domain
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    `https://${host}`,
    `http://${host}`,
  ].filter(Boolean);
  
  // Allow if origin matches
  if (origin && allowedOrigins.some(allowed => origin === allowed)) {
    return true;
  }
  
  // Allow if referer matches
  if (referer && allowedOrigins.some(allowed => referer.startsWith(allowed!))) {
    return true;
  }
  
  // For API clients without referer/origin, require explicit host match
  if (!referer && !origin && host) {
    const expectedHosts = [
      new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').host,
      host,
    ].filter(Boolean);
    
    return expectedHosts.includes(host);
  }
  
  return false;
}