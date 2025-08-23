# SQL Injection Prevention Guidelines

## CRITICAL: Security Vulnerability Fixed

**Date**: 2025-08-23
**Severity**: CRITICAL
**Location**: `/lib/webhook-audit.ts:283`
**Status**: FIXED ✅

### Vulnerability Details
- **Issue**: Direct string concatenation in SQL queries using `sql.raw()`
- **Risk**: Database takeover possible through SQL injection
- **Attack Vector**: Malicious input in `daysToKeep` parameter could execute arbitrary SQL

### Fix Applied
Replaced unsafe string interpolation with:
1. Input validation (integer check, range validation)
2. Date calculation in JavaScript
3. Parameterized query using Drizzle ORM's safe interpolation

## Best Practices for SQL Security

### ✅ ALWAYS DO

1. **Use Parameterized Queries**
   ```typescript
   // GOOD - Parameterized
   const result = await db.execute(sql`
     SELECT * FROM users WHERE id = ${userId}
   `);
   ```

2. **Validate Input Before Database Operations**
   ```typescript
   // GOOD - Validate first
   if (!Number.isInteger(days) || days < 0 || days > 365) {
     throw new Error('Invalid input');
   }
   ```

3. **Use Drizzle ORM Query Builder**
   ```typescript
   // GOOD - ORM methods
   const users = await db.select()
     .from(usersTable)
     .where(eq(usersTable.id, userId));
   ```

4. **Use sql.placeholder() for Prepared Statements**
   ```typescript
   // GOOD - Prepared statement
   const prepared = db
     .select()
     .from(users)
     .where(eq(users.id, sql.placeholder('userId')))
     .prepare();
   
   const result = await prepared.execute({ userId: 123 });
   ```

5. **Use sql.identifier() for Dynamic Table/Column Names**
   ```typescript
   // GOOD - Safe identifier
   await db.execute(sql`ANALYZE ${sql.identifier(tableName)}`);
   ```

### ❌ NEVER DO

1. **Never Use sql.raw() with User Input**
   ```typescript
   // BAD - SQL Injection vulnerability!
   const query = sql.raw(`DELETE FROM users WHERE id = ${userId}`);
   ```

2. **Never Concatenate Strings in SQL**
   ```typescript
   // BAD - SQL Injection vulnerability!
   const query = `SELECT * FROM users WHERE name = '${userName}'`;
   ```

3. **Never Trust Client Input**
   ```typescript
   // BAD - No validation
   const days = req.body.days;
   await db.execute(sql`DELETE FROM logs WHERE created < NOW() - INTERVAL '${days} days'`);
   ```

## Security Checklist

- [ ] All user inputs are validated before use in queries
- [ ] No `sql.raw()` used with dynamic values
- [ ] All queries use parameterized statements
- [ ] Input validation includes type checking and range validation
- [ ] Prepared statements used for repeated queries
- [ ] Error messages don't expose database structure
- [ ] Database user has minimal required permissions
- [ ] Regular security audits performed on database queries

## Testing for SQL Injection

Run these tests on all database functions:

```typescript
const sqlInjectionTests = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "admin'--",
  "1; DELETE FROM users",
  "' UNION SELECT * FROM passwords --"
];

// All should be safely handled or rejected
```

## Monitoring and Detection

1. **Log Suspicious Patterns**
   - Multiple failed queries from same source
   - Queries with SQL keywords in string parameters
   - Unusually long input strings

2. **Use Database Audit Logs**
   - Monitor for unexpected DROP, DELETE, UPDATE commands
   - Track failed authentication attempts
   - Alert on privilege escalation attempts

## Incident Response

If SQL injection is suspected:
1. Immediately revoke database credentials
2. Review audit logs for data access
3. Check for unauthorized modifications
4. Restore from backup if needed
5. Patch vulnerability
6. Update security monitoring

## References

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Drizzle ORM Security Best Practices](https://orm.drizzle.team/docs/sql)
- [PostgreSQL Security Documentation](https://www.postgresql.org/docs/current/sql-injection.html)