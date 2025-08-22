# Redis Configuration Guide for Production

## Overview

The Ecosystem Platform uses Redis for:
- **Rate Limiting**: Prevent abuse and ensure fair usage
- **Session Management**: Store user and guest sessions
- **Caching**: Improve performance for frequently accessed data
- **Analytics**: Track metrics and usage patterns

## Quick Start

### 1. Upstash Setup (Recommended for Production)

1. **Create an Upstash Account**
   ```bash
   # Visit https://upstash.com and create an account
   ```

2. **Create a Redis Database**
   - Go to Console → Redis Database → Create Database
   - Choose your region (closest to your users)
   - Enable "Eviction" for automatic memory management
   - Select "Strong Consistency" for production

3. **Get Your Credentials**
   ```bash
   # From Upstash Console, copy:
   UPSTASH_REDIS_REST_URL="https://your-database.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your-token-here"
   ```

4. **Add to Environment Variables**
   ```bash
   # .env.local (development)
   UPSTASH_REDIS_REST_URL="your-url"
   UPSTASH_REDIS_REST_TOKEN="your-token"
   
   # Production (Vercel/Railway/etc)
   # Add via platform dashboard
   ```

### 2. Optional: Multiple Redis Instances

For high-traffic production deployments, consider separate Redis instances:

```bash
# Primary rate limiting Redis
UPSTASH_REDIS_REST_URL="https://ratelimit.upstash.io"
UPSTASH_REDIS_REST_TOKEN="ratelimit-token"

# Cache Redis (optional - can use same as primary)
REDIS_CACHE_URL="https://cache.upstash.io"
REDIS_CACHE_TOKEN="cache-token"

# Session Redis (optional - can use same as primary)
REDIS_SESSION_URL="https://session.upstash.io"
REDIS_SESSION_TOKEN="session-token"
```

## Rate Limiting Configuration

The platform implements different rate limits for various endpoints:

| Endpoint Type | Limit | Window | Use Case |
|--------------|-------|---------|----------|
| Payment | 10 req | 1 min | Payment processing |
| Webhook | 10 req | 1 sec | Stripe webhooks |
| API | 100 req | 1 min | General API calls |
| Auth | 5 req | 15 min | Login/signup |
| Search | 30 req | 1 min | Provider search |
| Booking | 5 req | 5 min | Creating bookings |
| Guest Checkout | 3 req | 5 min | Guest bookings |

## Testing Your Configuration

### 1. Verify Environment Variables

```bash
npm run redis:check
```

### 2. Test Rate Limiting

```bash
# Test rate limiting with curl
for i in {1..12}; do
  curl -X GET http://localhost:3000/api/providers
  echo ""
done
# Should get rate limited after 10 requests
```

### 3. Monitor Redis Health

```bash
# Check Redis health endpoint
curl http://localhost:3000/api/health/redis
```

## Production Deployment

### Vercel Deployment

1. **Add Environment Variables**
   ```bash
   vercel env add UPSTASH_REDIS_REST_URL
   vercel env add UPSTASH_REDIS_REST_TOKEN
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

### Railway Deployment

1. **Add Variables via Dashboard**
   - Go to your service → Variables
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

2. **Deploy**
   ```bash
   railway up
   ```

### Docker Deployment

```dockerfile
# Add to docker-compose.yml
services:
  app:
    environment:
      - UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
      - UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
```

## Monitoring & Alerts

### 1. Upstash Dashboard

Monitor via Upstash Console:
- Request count
- Memory usage
- Latency metrics
- Error rates

### 2. Custom Monitoring

```typescript
// Check Redis health
const health = await HealthMonitor.checkHealth();
console.log('Redis Health:', health);

// Get metrics
const metrics = await HealthMonitor.getMetrics();
console.log('Redis Metrics:', metrics);
```

### 3. Set Up Alerts

Configure alerts in Upstash for:
- Memory usage > 80%
- Latency > 100ms
- Error rate > 1%

## Troubleshooting

### Issue: "Redis not configured" Warning

**Solution**: Ensure environment variables are set:
```bash
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

### Issue: Rate Limiting Not Working

**Solution**: Check Redis connection:
```bash
npm run redis:health
```

### Issue: High Latency

**Solutions**:
1. Choose region closer to your servers
2. Upgrade Upstash plan for better performance
3. Implement local caching for frequently accessed data

### Issue: Memory Limit Exceeded

**Solutions**:
1. Enable eviction policy in Upstash
2. Reduce cache TTL values
3. Upgrade to larger Redis instance

## Fallback Behavior

If Redis is unavailable, the platform automatically falls back to:
- **In-memory rate limiting** (not suitable for multi-instance deployments)
- **Local session storage** (sessions won't persist across servers)
- **No caching** (direct database queries)

⚠️ **Warning**: In-memory fallback is NOT recommended for production as it:
- Doesn't work across multiple server instances
- Loses data on server restart
- Can't handle high traffic properly

## Cost Optimization

### Upstash Pricing (as of 2024)

- **Free Tier**: 10,000 commands/day
- **Pay as you go**: $0.2 per 100K commands
- **Pro**: $120/month for 1M commands/day

### Optimization Tips

1. **Use appropriate TTLs**
   ```typescript
   // Short TTL for frequently changing data
   CacheService.set(key, data, 30); // 30 seconds
   
   // Longer TTL for static data
   CacheService.set(key, data, 3600); // 1 hour
   ```

2. **Batch operations when possible**
   ```typescript
   // Instead of multiple gets
   const pipeline = redis.pipeline();
   keys.forEach(key => pipeline.get(key));
   const results = await pipeline.exec();
   ```

3. **Use efficient data structures**
   ```typescript
   // Use sets for unique tracking
   redis.sadd('unique_visitors', userId);
   
   // Use sorted sets for leaderboards
   redis.zadd('provider_ratings', score, providerId);
   ```

## Security Best Practices

1. **Never expose Redis credentials in client code**
2. **Use read-only tokens where possible**
3. **Implement IP whitelisting in Upstash**
4. **Rotate tokens regularly**
5. **Monitor for unusual patterns**

## Next Steps

1. ✅ Configure Upstash Redis
2. ✅ Add environment variables
3. ✅ Test rate limiting
4. ✅ Deploy to production
5. 📊 Monitor performance
6. 🔧 Optimize as needed

## Support

- **Upstash Documentation**: https://docs.upstash.com
- **Redis Commands**: https://redis.io/commands
- **Platform Support**: support@ecosystem.com

---

Last Updated: January 2025