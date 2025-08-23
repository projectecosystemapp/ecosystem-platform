/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for security
  experimental: {
    // Server component external packages
    serverComponentsExternalPackages: ['crypto', '@upstash/redis'],
  },
  
  // Configure headers for security
  async headers() {
    return [
      {
        // Apply security headers to all pages (middleware will handle API routes)
        source: '/((?!api).*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Powered-By',
            value: 'Ecosystem Platform',
          },
          // Remove default X-Powered-By header
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
  
  // Configure redirects for security
  async redirects() {
    return [
      // Redirect HTTP to HTTPS in production
      ...(process.env.NODE_ENV === 'production' 
        ? [
            {
              source: '/:path*',
              has: [
                {
                  type: 'header',
                  key: 'x-forwarded-proto',
                  value: 'http',
                },
              ],
              destination: 'https://ecosystem-platform.com/:path*',
              permanent: true,
            },
          ]
        : []
      ),
    ];
  },
  
  // Configure rewrites for API security
  async rewrites() {
    return [
      // Add security context to API routes
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  
  // Webpack configuration for security
  webpack: (config, { isServer }) => {
    // Security-related webpack optimizations
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    return config;
  },
  
  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Enable static optimization for better security
  trailingSlash: false,
  
  // Configure image optimization for security
  images: {
    domains: [
      'images.clerk.dev',
      'img.clerk.com',
      'www.gravatar.com',
      'lh3.googleusercontent.com',
      'api.dicebear.com',
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Compress responses
  compress: true,
  
  // Remove powered by header
  poweredByHeader: false,
  
  // Enable strict mode
  reactStrictMode: true,
  
  // Optimize bundle
  swcMinify: true,
};

export default nextConfig;
