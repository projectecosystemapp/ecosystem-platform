import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/become-a-provider(.*)",
  "/api/stripe/connect/accounts(.*)",
  "/api/stripe/connect/link",
  "/api/bookings(.*)",
  "/api/user(.*)",
]);

// Define public API routes that don't require authentication
const isPublicApiRoute = createRouteMatcher([
  "/api/stripe/webhooks(.*)",
  "/api/stripe/connect/webhooks(.*)",
  "/api/providers/search",
  "/api/providers/[slug]",
]);

// Define admin-only routes
const isAdminRoute = createRouteMatcher([
  "/dashboard/admin(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  
  // Check if route requires authentication
  if (isProtectedRoute(req)) {
    // Redirect to login if not authenticated
    if (!userId) {
      await auth().protect();
    }
    
    // Check admin access for admin routes
    if (isAdminRoute(req)) {
      const metadata = sessionClaims?.metadata as { role?: string } | undefined;
      const isAdmin = metadata?.role === "admin";
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized: Admin access required" },
          { status: 403 }
        );
      }
    }
  }
  
  // Add security headers for API routes
  if (req.url.includes("/api/")) {
    const response = NextResponse.next();
    
    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // CORS headers for API (adjust origins as needed)
    const origin = req.headers.get("origin");
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "https://ecosystem-platform.com"
    ].filter(Boolean);
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.headers.set("Access-Control-Max-Age", "86400");
    }
    
    return response;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
