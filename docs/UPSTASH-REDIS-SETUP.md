# Upstash Redis Setup Guide

This guide walks you through setting up Upstash Redis for distributed rate limiting across multiple server instances.

## Overview

Upstash Redis is a serverless Redis service that's perfect for rate limiting because:
- **Serverless-friendly**: No connection management required
- **Global distribution**: Low latency worldwide  
- **Auto-scaling**: Handles traffic spikes automatically
- **Pay-per-request**: Cost-effective pricing model
- **Built-in security**: DDoS protection and authentication

## Quick Start

### 1. Create Upstash Account

1. Go to [console.upstash.com](https://console.upstash.com)
2. Sign up for a free account
3. Create a new Redis database
4. Choose the region closest to your application

### 2. Get Configuration

From your Upstash Redis dashboard:
1. Copy the **REST URL** (looks like `https://your-database.upstash.io`)
2. Copy the **REST Token** (starts with `AX...`)

### 3. Environment Setup

Add these variables to your `.env.local`:

```bash
# Upstash Redis Configuration (Required for Rate Limiting)
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxACQgxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Test Connection

Run the test script to verify everything works:

```bash
npm run redis:test
```

## Rate Limiting Configuration

The system uses different rate limits for different endpoints:

| Endpoint Type | Limit | Window | Usage |
|--------------|-------|---------|-------|
| API (general) | 100 requests | 1 minute | Most API endpoints |
| Search | 30 requests | 1 minute | Search operations |
| Booking | 10 requests | 1 minute | Booking operations |
| Payment/Auth | 5 requests | 15 minutes | Critical operations |
| Pages | 60 requests | 1 minute | Page requests |
| Webhooks | 100 requests | 1 second | External webhooks |

## Architecture

### Edge Runtime (Middleware)
- Uses `@upstash/ratelimit` package
- Runs on all requests through Next.js middleware
- Edge-compatible (no Node.js dependencies)
- Handles immediate blocking

### API Routes  
- Uses `@upstash/redis` package
- Custom sliding window implementation
- More flexible for complex logic
- Falls back to in-memory if Redis unavailable

### Fallback Strategy
1. **Primary**: Upstash Redis (distributed)
2. **Fallback**: In-memory (per-instance)
3. **Error**: Allow request (fail open)

## Production Deployment

### 1. Environment Variables

Set these in your production environment:

```bash
UPSTASH_REDIS_REST_URL=https://your-production-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-production-token
```

### 2. Health Monitoring

Monitor rate limiting health:

```bash
# Basic health check
curl https://yourapp.com/api/health/redis

# Detailed metrics (requires auth token)
curl https://yourapp.com/api/health/redis \
  -H "Authorization: Bearer $HEALTH_CHECK_TOKEN"
```

### 3. Testing Rate Limits

Test your rate limits work correctly:

```bash
# Test API endpoint multiple times
for i in {1..10}; do
  curl -w "Status: %{http_code}\\n" https://yourapp.com/api/some-endpoint
done
```

### 4. Upstash Dashboard

Monitor usage in the Upstash console:
- Request volume and latency
- Memory usage
- Error rates
- Geographic distribution

## Configuration Options

### Rate Limit Thresholds

Override default rate limits via environment variables:

```bash
# Custom API rate limits
RATE_LIMIT_API_REQUESTS=150
RATE_LIMIT_API_WINDOW=60000

# Custom auth rate limits  
RATE_LIMIT_AUTH_REQUESTS=3
RATE_LIMIT_AUTH_WINDOW=900000
```

### Redis Connection

Fine-tune Redis settings:

```bash
# Connection timeout (milliseconds)
REDIS_CONNECT_TIMEOUT=5000

# Request timeout (milliseconds)
REDIS_REQUEST_TIMEOUT=3000
```

## Troubleshooting

### Connection Issues

**Error**: `Upstash Redis not configured`
- Check that both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
- Verify the values are correct (copy-paste from Upstash dashboard)

**Error**: `Connection timeout`
- Check your network can reach Upstash servers
- Try a different region closer to your deployment
- Verify firewall settings

### Rate Limiting Not Working

**Issue**: Rate limits not being enforced
- Check the health endpoint: `/api/health/redis`
- Look for "in-memory" provider (means Redis failed)
- Check server logs for Redis connection errors

**Issue**: Too restrictive rate limits
- Review rate limit configs in `lib/security/rate-limit.ts`
- Check if you're hitting user-specific vs IP-based limits
- Monitor Upstash dashboard for usage patterns

### Performance Issues

**Issue**: High latency
- Choose Upstash region closest to your app deployment
- Monitor request latency in Upstash dashboard
- Consider upgrading to higher-performance tier

**Issue**: Rate limit false positives
- Check if you're using the correct identifier (user ID vs IP)
- Review sliding window vs fixed window behavior
- Adjust time windows for your use case

## Migration from Other Redis

If migrating from another Redis provider:

1. **Update Environment Variables**:
   ```bash
   # Remove old Redis config
   # REDIS_HOST=...
   # REDIS_PORT=...
   # REDIS_PASSWORD=...
   
   # Add Upstash config
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

2. **Test Both Systems**: Run both temporarily to ensure smooth transition

3. **Monitor**: Watch error rates during migration

4. **Cleanup**: Remove old Redis dependencies once confirmed working

## Best Practices

### Security
- Rotate REST tokens regularly
- Use different databases for dev/staging/production
- Monitor unusual rate limit patterns

### Performance  
- Choose regions close to your users
- Use appropriate time windows (not too short/long)
- Monitor Upstash analytics for optimization

### Reliability
- Always implement fallback strategies
- Test failure scenarios
- Monitor health endpoints
- Set up alerting for Redis failures

## Support

- **Documentation**: [docs.upstash.com](https://docs.upstash.com)
- **Status**: [status.upstash.com](https://status.upstash.com)
- **Discord**: [discord.gg/upstash](https://discord.gg/upstash)

For application-specific issues:
- Check `/api/health/redis` endpoint
- Review server logs
- Run `npm run redis:test` for diagnostics