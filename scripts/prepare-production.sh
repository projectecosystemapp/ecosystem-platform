#!/bin/bash

# Production Build Preparation Script
# This script copies only necessary files for production deployment

SOURCE_DIR="/Users/ryleebenson/code/ecosys/codespring-boilerplate"
DEST_DIR="/Users/ryleebenson/code/ecosys/ecosystem-production"

echo "🚀 Preparing production build..."

# Clean destination directory
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

# Copy essential application files
echo "📁 Copying application files..."
cp -r "$SOURCE_DIR/app" "$DEST_DIR/"
cp -r "$SOURCE_DIR/components" "$DEST_DIR/"
cp -r "$SOURCE_DIR/lib" "$DEST_DIR/"
cp -r "$SOURCE_DIR/hooks" "$DEST_DIR/"
cp -r "$SOURCE_DIR/contexts" "$DEST_DIR/"
cp -r "$SOURCE_DIR/actions" "$DEST_DIR/"
cp -r "$SOURCE_DIR/db" "$DEST_DIR/"
cp -r "$SOURCE_DIR/modules" "$DEST_DIR/"
cp -r "$SOURCE_DIR/services" "$DEST_DIR/"
cp -r "$SOURCE_DIR/config" "$DEST_DIR/"
cp -r "$SOURCE_DIR/public" "$DEST_DIR/"
cp -r "$SOURCE_DIR/types" "$DEST_DIR/"

# Copy configuration files
echo "⚙️ Copying configuration files..."
cp "$SOURCE_DIR/package.json" "$DEST_DIR/"
cp "$SOURCE_DIR/package-lock.json" "$DEST_DIR/"
cp "$SOURCE_DIR/tsconfig.json" "$DEST_DIR/"
cp "$SOURCE_DIR/next.config.mjs" "$DEST_DIR/"
cp "$SOURCE_DIR/tailwind.config.ts" "$DEST_DIR/"
cp "$SOURCE_DIR/postcss.config.mjs" "$DEST_DIR/"
cp "$SOURCE_DIR/drizzle.config.ts" "$DEST_DIR/"
cp "$SOURCE_DIR/middleware.ts" "$DEST_DIR/"
cp "$SOURCE_DIR/components.json" "$DEST_DIR/"

# Copy Sentry configuration
cp "$SOURCE_DIR/sentry.client.config.ts" "$DEST_DIR/" 2>/dev/null || true
cp "$SOURCE_DIR/sentry.edge.config.ts" "$DEST_DIR/" 2>/dev/null || true
cp "$SOURCE_DIR/sentry.server.config.ts" "$DEST_DIR/" 2>/dev/null || true

# Create environment files
echo "🔐 Creating environment templates..."
cp "$SOURCE_DIR/.env.example" "$DEST_DIR/"
cp "$SOURCE_DIR/.env.production.example" "$DEST_DIR/"

# Copy essential documentation
echo "📚 Copying essential documentation..."
cp "$SOURCE_DIR/README.md" "$DEST_DIR/"
cp "$SOURCE_DIR/CLAUDE.md" "$DEST_DIR/"
mkdir -p "$DEST_DIR/docs"
cp "$SOURCE_DIR/docs/ARCHITECTURE.md" "$DEST_DIR/docs/" 2>/dev/null || true
cp "$SOURCE_DIR/docs/DEPLOYMENT-OPS.md" "$DEST_DIR/docs/" 2>/dev/null || true
cp "$SOURCE_DIR/docs/SECURITY-FIXES.md" "$DEST_DIR/docs/" 2>/dev/null || true

# Remove test and development files
echo "🧹 Cleaning up development files..."
find "$DEST_DIR" -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -type d -name "e2e" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -type d -name ".swc" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -type f -name "*.test.ts" -delete 2>/dev/null || true
find "$DEST_DIR" -type f -name "*.test.tsx" -delete 2>/dev/null || true
find "$DEST_DIR" -type f -name "*.spec.ts" -delete 2>/dev/null || true
find "$DEST_DIR" -type f -name "*.spec.tsx" -delete 2>/dev/null || true
find "$DEST_DIR" -type f -name ".DS_Store" -delete 2>/dev/null || true

# Create production .gitignore
cat > "$DEST_DIR/.gitignore" << 'EOF'
# Dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# Production
/build
/.next/
/out/

# Environment
.env
.env.local
.env.production
*.env

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Testing
/coverage
/test-results

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Misc
*.pem
.vercel
secrets/
.secrets
EOF

# Create production README
cat > "$DEST_DIR/PRODUCTION_README.md" << 'EOF'
# Ecosystem Production Deployment

This folder contains the production-ready version of the Ecosystem Marketplace.

## Pre-Deployment Checklist

- [ ] Set all required environment variables
- [ ] Configure Redis/Upstash for rate limiting
- [ ] Set up Sentry for error monitoring
- [ ] Configure Stripe webhook endpoints
- [ ] Set up database backups
- [ ] Configure CDN for static assets
- [ ] Set up monitoring and alerting

## Environment Variables

Copy `.env.example` to `.env.production` and fill in all required values:

```bash
cp .env.example .env.production
```

Required variables:
- DATABASE_URL
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- CSRF_SECRET (generate with: openssl rand -hex 32)
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- NEXT_PUBLIC_SENTRY_DSN
- SENTRY_DSN

## Build and Deploy

1. Install dependencies:
```bash
npm ci --production
```

2. Run database migrations:
```bash
npm run db:migrate
```

3. Build the application:
```bash
npm run build
```

4. Start the production server:
```bash
npm start
```

## Health Check

After deployment, verify the system health:

```bash
curl https://your-domain.com/api/health?detailed=true
```

## Security Notes

- Never commit `.env.production` to version control
- Rotate CSRF_SECRET regularly
- Use strong, unique passwords for all services
- Enable 2FA on all admin accounts
- Monitor security alerts from Sentry

## Support

For deployment issues, refer to `/docs/DEPLOYMENT-OPS.md`
EOF

echo "✅ Production build prepared successfully!"
echo "📂 Location: $DEST_DIR"
echo ""
echo "Next steps:"
echo "1. cd $DEST_DIR"
echo "2. Copy your .env.production file"
echo "3. npm ci --production"
echo "4. npm run build"
echo "5. Deploy to your hosting platform"