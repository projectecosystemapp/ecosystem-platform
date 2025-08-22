# Database Optimization Deployment Guide

This guide walks you through deploying the comprehensive database optimizations for your Next.js booking platform.

## 📋 Prerequisites

- PostgreSQL 14+ with full-text search support
- Redis instance (or fallback to in-memory cache)
- Database access with CREATE INDEX privileges
- Node.js 18+ with TypeScript support

## 🚀 Deployment Steps

### 1. Database Schema Migration

```bash
# Run the performance optimization migration
npm run db:migrate

# Or manually apply the migration
psql -d your_database -f db/migrations/0013_performance_optimization_indexes.sql
```

This migration adds:
- 25+ strategic performance indexes
- Missing foreign key constraints
- Full-text search indexes (GIN)
- Materialized views for statistics
- Row Level Security policies

### 2. Environment Variables

Add Redis configuration to your environment:

```bash
# .env.local or production environment
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### 3. Install Dependencies

The optimizations work with existing dependencies. Optionally install ioredis for production:

```bash
npm install ioredis
# or
yarn add ioredis
```

### 4. Update Action Files (Gradual Migration)

Replace existing query calls with optimized versions:

```typescript
// Before
import { searchProviders } from '@/db/queries/providers-queries'

// After  
import { searchProvidersOptimized } from '@/db/queries/optimized-providers-queries'
```

### 5. Verify Deployment

Run the benchmark to confirm optimizations:

```bash
npm run benchmark
```

Expected improvements:
- Provider search: 70-90% faster
- Availability calculation: 60-80% faster  
- Dashboard queries: 50-70% faster

## 🔧 Configuration Options

### Redis Cache Configuration

```typescript
// lib/cache.ts - Adjust TTLs based on your needs
export const CACHE_TTL = {
  PROVIDER_PROFILE: 30 * 60, // 30 minutes
  PROVIDER_SEARCH: 10 * 60,  // 10 minutes
  PROVIDER_AVAILABILITY: 15 * 60, // 15 minutes
  // ... other configurations
}
```

### Database Connection Pooling

For production, configure connection pooling in `db/db.ts`:

```typescript
const db = drizzle(postgres(connectionString, {
  max: 20,        // Maximum connections
  idle_timeout: 20000,
  max_lifetime: 60 * 30,
}));
```

## 📊 Monitoring & Alerting

### Query Performance Monitoring

1. **Enable pg_stat_statements**:
```sql
-- Add to postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

2. **Monitor slow queries**:
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls, total_exec_time 
FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC;
```

### Cache Performance Monitoring

Monitor cache hit rates and response times:

```typescript
// Add to your monitoring service
const cacheMetrics = {
  hitRate: hits / (hits + misses),
  avgResponseTime: totalTime / requests,
  evictionRate: evictions / sets
}
```

### Recommended Alerts

Set up alerts for:
- Query execution time > 500ms
- Cache hit rate < 80%
- Database connection pool > 80% usage
- Index usage efficiency < 90%

## 🎯 Performance Targets

After deployment, you should see:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Provider search | 200-500ms | 30-100ms | 70-90% |
| Availability calc | 150-300ms | 30-80ms | 60-80% |
| Dashboard load | 300-600ms | 100-200ms | 50-70% |
| Cache hit rate | N/A | 85-95% | New capability |

## 🔄 Rollback Plan

If issues occur, you can rollback:

1. **Disable new queries**: Keep using original functions
2. **Drop indexes** (if needed):
```sql
-- Only if causing issues
DROP INDEX CONCURRENTLY idx_providers_fulltext;
-- etc.
```

3. **Disable caching**: Set all TTLs to 0

## 📈 Gradual Migration Strategy

1. **Phase 1**: Deploy indexes and caching (no code changes)
2. **Phase 2**: Update one action file at a time
3. **Phase 3**: Monitor performance and fix any issues
4. **Phase 4**: Complete migration of all queries

## 🧪 Testing Recommendations

### Load Testing

```bash
# Use existing k6 scripts with new queries
npm run test:load

# Monitor query performance
npm run benchmark
```

### A/B Testing

Deploy optimizations to staging first:
- Test with production-like data volumes
- Measure performance improvements
- Validate cache invalidation works correctly

## 📋 Post-Deployment Checklist

- [ ] Migration applied successfully
- [ ] All indexes created without errors
- [ ] Redis connection working
- [ ] Cache hit rates > 80%
- [ ] Query times improved as expected
- [ ] No performance regressions
- [ ] Monitoring alerts configured
- [ ] Backup procedures updated

## 🆘 Troubleshooting

### Common Issues

**High memory usage**: Adjust cache TTLs or increase Redis memory

**Lock timeouts**: Index creation may take time on large tables

**Cache misses**: Check Redis connectivity and key expiration

**Type errors**: Ensure all imports use optimized query functions

### Support

For issues with the optimizations:
1. Check logs for query errors
2. Monitor database performance metrics
3. Verify cache hit rates
4. Run benchmark to identify bottlenecks

## 🔮 Future Optimizations

Consider these additional optimizations:

- **Read Replicas**: For read-heavy workloads
- **Query Result Pagination**: Cursor-based for large datasets  
- **Database Sharding**: For multi-tenant scalability
- **Background Jobs**: Move heavy calculations to workers
- **CDN Caching**: Cache static provider data

---

This deployment guide ensures a smooth rollout of the database optimizations while maintaining system stability and performance.
