import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Core performance optimizations
  experimental: {
    // Enable React Compiler for better performance
    reactCompiler: true,
    
    // Optimize font loading
    optimizeFonts: true,
    
    // Preload modules for better startup performance  
    turbo: {
      rules: {
        // Optimize CSS processing
        '*.module.css': {
          loaders: ['css-loader'],
          as: 'css',
        },
      },
    },
    
    // Enable static optimization
    largePageDataBytes: 128 * 1000, // 128KB
  },

  // Bundle optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Enable webpack bundle analyzer in development
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          analyzerPort: isServer ? 8888 : 8889,
          openAnalyzer: true,
        })
      );
    }

    // Production optimizations
    if (!dev) {
      // Tree shaking improvements
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        
        // Split chunks for better caching
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Framework chunks
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            
            // UI library chunks
            ui: {
              chunks: 'all',
              name: 'ui',
              test: /[\\/]node_modules[\\/](@radix-ui|@headlessui|framer-motion)[\\/]/,
              priority: 30,
            },
            
            // Database and utilities
            libs: {
              chunks: 'all',
              name: 'libs',
              test: /[\\/]node_modules[\\/](drizzle-orm|zod|clsx|tailwind-merge)[\\/]/,
              priority: 20,
            },
            
            // Common vendor chunks
            vendor: {
              chunks: 'all',
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
            },
            
            // Default
            default: {
              minChunks: 2,
              priority: -10,
              reuseExistingChunk: true,
            },
          },
        },
      };

      // Minimize bundle size
      config.optimization.minimize = true;
      
      // Module concatenation for smaller bundles
      config.optimization.concatenateModules = true;
    }

    return config;
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    
    // External image domains
    domains: [
      'images.unsplash.com',
      'via.placeholder.com',
      'res.cloudinary.com',
      'lh3.googleusercontent.com',
      'img.clerk.com',
    ],
    
    // Enable optimized loading
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Compression
  compress: true,
  
  // Static optimization
  trailingSlash: false,
  
  // Headers for performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Cache static assets
          {
            key: 'Cache-Control',
            value: 's-maxage=31536000, stale-while-revalidate=59',
          },
          // Security headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      // Static assets caching
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API routes caching
      {
        source: '/api/providers/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
    ];
  },

  // Redirects for performance
  async redirects() {
    return [
      // Redirect old URLs to new ones
      {
        source: '/provider/:slug',
        destination: '/providers/:slug',
        permanent: true,
      },
    ];
  },

  // Rewrites for clean URLs
  async rewrites() {
    return [
      {
        source: '/api/health',
        destination: '/api/health/route',
      },
    ];
  },

  // Output configuration for deployment
  output: 'standalone',
  
  // Power consumption optimization (for edge deployment)
  poweredByHeader: false,
  
  // Enable SWC minification
  swcMinify: true,
  
  // Disable source maps in production for smaller bundles
  productionBrowserSourceMaps: false,
  
  // Optimize CSS
  experimental: {
    ...nextConfig.experimental,
    optimizeCss: true,
  },

  // Environment variables optimization
  env: {
    // Only include necessary env vars for client
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },

  // TypeScript configuration
  typescript: {
    // Type checking is handled by CI/CD
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },

  // ESLint configuration
  eslint: {
    // Linting is handled by CI/CD
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
};

// Add Sentry configuration
export default withSentryConfig(nextConfig, {
  // Sentry configuration options
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Upload source maps only in production
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});