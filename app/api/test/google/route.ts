/**
 * Test endpoint for Google integration
 * Verifies OAuth and Maps API configuration
 */

import { NextResponse } from 'next/server';
import { isGoogleOAuthConfigured } from '@/lib/google-auth';
import { isGoogleMapsConfigured, geocodeAddress } from '@/lib/google-maps';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const testAddress = url.searchParams.get('address') || '1600 Amphitheatre Parkway, Mountain View, CA';
  
  const results = {
    timestamp: new Date().toISOString(),
    oauth: {
      configured: isGoogleOAuthConfigured(),
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
    },
    maps: {
      configured: isGoogleMapsConfigured(),
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Set' : 'Not set',
    },
    geocoding: null as any,
  };
  
  // Test geocoding if Maps is configured
  if (isGoogleMapsConfigured()) {
    try {
      const geocoded = await geocodeAddress(testAddress);
      results.geocoding = {
        success: true,
        input: testAddress,
        result: geocoded,
      };
    } catch (error) {
      results.geocoding = {
        success: false,
        error: error instanceof Error ? error.message : 'Geocoding failed',
      };
    }
  }
  
  const allConfigured = results.oauth.configured && results.maps.configured;
  
  return NextResponse.json(
    {
      status: allConfigured ? 'configured' : 'partial',
      message: allConfigured 
        ? 'Google OAuth and Maps are properly configured' 
        : 'Some Google services are not configured',
      ...results,
    },
    { 
      status: allConfigured ? 200 : 206,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}