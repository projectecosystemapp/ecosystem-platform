# 🌐 Google Integration Guide

Your ecosystem marketplace now has Google OAuth and Google Maps API fully configured and ready to use!

## ✅ Configuration Status

### Google OAuth
- **Client ID**: ✅ Configured
- **Client Secret**: ✅ Configured  
- **Account**: customer-support@projectecosystemapp.com
- **Status**: Ready for social login integration

### Google Maps API
- **API Key**: ✅ Configured
- **Geocoding**: ✅ Tested and working
- **Status**: Ready for location services

## 🔑 Available Features

### 1. Google Sign-In (OAuth)
Enable users to sign in with their Google accounts:

```typescript
import { getGoogleAuthUrl } from '@/lib/google-auth';

// Generate OAuth URL
const authUrl = getGoogleAuthUrl(
  'unique-state-token',
  'http://localhost:3000/api/auth/google/callback'
);

// Redirect user to Google
window.location.href = authUrl;
```

### 2. Location Services (Maps API)

#### Geocoding Addresses
Convert addresses to coordinates:

```typescript
import { geocodeAddress } from '@/lib/google-maps';

const location = await geocodeAddress('123 Main St, San Francisco, CA');
console.log(location);
// { lat: 37.7749, lng: -122.4194, formattedAddress: '...', placeId: '...' }
```

#### Calculate Distances
Find distance between provider and customer:

```typescript
import { calculateDistance } from '@/lib/google-maps';

const distance = calculateDistance(
  { lat: 37.7749, lng: -122.4194 }, // Provider
  { lat: 37.7849, lng: -122.4094 }  // Customer
);
console.log(`Distance: ${distance} km`);
```

#### Get Current Location
Request user's location:

```typescript
import { getCurrentLocation } from '@/lib/google-maps';

const position = await getCurrentLocation();
console.log(`User at: ${position.coords.latitude}, ${position.coords.longitude}`);
```

## 🗺️ Use Cases for Your Marketplace

### Provider Features
1. **Location-Based Search**: Find providers near customers
2. **Service Areas**: Define and visualize service coverage
3. **Route Planning**: Calculate travel time to customers
4. **Address Validation**: Ensure accurate provider locations

### Customer Features  
1. **Nearby Providers**: Discover services in their area
2. **Distance Filtering**: Sort by proximity
3. **Visual Maps**: See provider locations on interactive maps
4. **Delivery Estimates**: Calculate arrival times

## 📱 Implementation Examples

### Add Map to Provider Profile
```tsx
import { useEffect } from 'react';
import { loadGoogleMapsScript } from '@/lib/google-maps';

export function ProviderMap({ address }) {
  useEffect(() => {
    loadGoogleMapsScript().then(() => {
      // Initialize map
      const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 12,
      });
      
      // Add provider marker
      new google.maps.Marker({
        position: { lat: 37.7749, lng: -122.4194 },
        map,
        title: 'Provider Location',
      });
    });
  }, []);
  
  return <div id="map" style={{ height: '400px', width: '100%' }} />;
}
```

### Add Google Sign-In Button
```tsx
export function GoogleSignInButton() {
  const handleGoogleSignIn = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth_state', state);
    
    const authUrl = getGoogleAuthUrl(
      state,
      `${window.location.origin}/api/auth/google/callback`
    );
    
    window.location.href = authUrl;
  };
  
  return (
    <button 
      onClick={handleGoogleSignIn}
      className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
    >
      <GoogleIcon />
      Sign in with Google
    </button>
  );
}
```

## 🔒 Security Notes

1. **API Keys**: 
   - Public key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) is restricted to your domains
   - Never expose the OAuth client secret in client-side code

2. **OAuth Security**:
   - Always validate state parameter to prevent CSRF
   - Use HTTPS in production for redirect URIs
   - Verify ID tokens on the server side

3. **Rate Limits**:
   - Google Maps API: 25,000 requests/day (free tier)
   - Geocoding: 2,500 requests/day (free tier)
   - Monitor usage in Google Cloud Console

## 🚀 Next Steps

### Configure OAuth Redirect URIs
In [Google Cloud Console](https://console.cloud.google.com/):
1. Go to APIs & Services → Credentials
2. Click on your OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/google/callback`
   - Ngrok: `https://24f4f1c8aa5f.ngrok-free.app/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`

### Restrict API Keys
1. Go to APIs & Services → Credentials
2. Click on your Maps API key
3. Add application restrictions:
   - HTTP referrers for web
   - Add allowed domains:
     - `http://localhost:3000/*`
     - `https://*.ngrok-free.app/*`
     - `https://yourdomain.com/*`

### Enable Required APIs
Ensure these APIs are enabled in Google Cloud Console:
- ✅ Maps JavaScript API
- ✅ Geocoding API  
- ✅ Places API
- ✅ Directions API
- ✅ Distance Matrix API (for batch distance calculations)

## 📊 Monitoring

Track your API usage:
- **Dashboard**: https://console.cloud.google.com/apis/dashboard
- **Quotas**: https://console.cloud.google.com/apis/quotas
- **Billing**: https://console.cloud.google.com/billing

## 🧪 Testing

Test your integration:
```bash
# Test locally
curl http://localhost:3000/api/test/google

# Test through ngrok  
curl https://24f4f1c8aa5f.ngrok-free.app/api/test/google

# Test geocoding with custom address
curl "http://localhost:3000/api/test/google?address=Empire+State+Building,+NY"
```

---

Your Google integration is ready to enhance your marketplace with social login and powerful location features! 🎉