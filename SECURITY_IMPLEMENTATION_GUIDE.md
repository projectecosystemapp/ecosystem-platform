# 🔒 Security Implementation Guide

## Overview

This guide covers the comprehensive security measures implemented for the Ecosystem Platform marketplace. Our security implementation follows industry best practices and provides defense-in-depth protection against common web vulnerabilities.

## 🛡️ Security Features Implemented

### 1. CSRF Protection
- **Location**: `lib/security/csrf.ts`, `middleware.ts`
- **Features**: 
  - Cryptographically secure token generation
  - Signed tokens with timestamp validation
  - Automatic token rotation
  - Cookie-based token storage with secure flags

### 2. Security Headers
- **Location**: `lib/security/headers.ts`, `middleware.ts`
- **Features**:
  - Content Security Policy (CSP) optimized for Clerk, Stripe, Supabase
  - HTTP Strict Transport Security (HSTS)
  - X-Frame-Options for clickjacking protection
  - X-Content-Type-Options for MIME sniffing protection
  - Referrer Policy controls

### 3. Rate Limiting
- **Location**: `lib/security/rate-limit.ts`
- **Features**:
  - Redis-based rate limiting with Upstash
  - In-memory fallback for development
  - Configurable limits per endpoint type
  - Sliding window algorithm

### 4. Input Validation & Sanitization
- **Location**: `lib/security/validation.ts`
- **Features**:
  - Zod schema validation
  - XSS protection
  - SQL injection prevention
  - File upload validation
  - Content sanitization

### 5. API Security
- **Location**: `lib/security/api-handler.ts`
- **Features**:
  - Secure API route wrapper
  - Authentication/authorization checks
  - Request validation
  - Audit logging
  - Error handling

## 🚀 Quick Setup

### 1. Environment Variables

Copy the security configuration template:
```bash
cp .env.security.example .env.local
```

Update the following variables:
```env
# Generate with: openssl rand -hex 32
CSRF_SECRET=your-32-character-minimum-secret-key-here

# Redis for rate limiting (get from https://console.upstash.com/)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token

# Security feature toggles
ENABLE_CSRF=true
ENABLE_RATE_LIMIT=true
ENABLE_SECURITY_HEADERS=true
```

### 2. Install Dependencies

The security system uses the following packages (already installed):
```bash
npm install crypto-js @upstash/ratelimit @upstash/redis zod
```

### 3. Run Security Audit

Check your security implementation:
```bash
npx tsx scripts/security-audit.ts
```

## 📋 Usage Examples

### CSRF Protection in Forms

```tsx
import { SecureForm } from '@/components/security/secure-form';

function MyForm() {
  return (
    <SecureForm
      action="/api/provider/update"
      method="POST"
      onSuccess={(data) => console.log('Success:', data)}
      className="space-y-4"
    >
      <input name="name" type="text" required />
      <button type="submit">Save</button>
    </SecureForm>
  );
}
```

### CSRF Protection in API Calls

```tsx
import { useCSRF } from '@/hooks/use-csrf';

function MyComponent() {
  const { fetchWithCSRF } = useCSRF();
  
  const handleApiCall = async () => {
    const response = await fetchWithCSRF('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'example' }),
    });
  };
}
```

### Secure API Routes

```tsx
import { createSecureApiHandler, createApiResponse } from '@/lib/security/api-handler';
import { z } from 'zod';

const updateProviderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
});

export const POST = createSecureApiHandler(
  async (request, context) => {
    const body = getValidatedBody<z.infer<typeof updateProviderSchema>>(request);
    
    // Your business logic here
    const result = await updateProvider(body, context.userId);
    
    return createApiResponse(result, { message: 'Provider updated successfully' });
  },
  {
    requireAuth: true,
    validateBody: updateProviderSchema,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
  }
);
```

### Input Validation

```tsx
import { securitySchemas, validateApiRequest } from '@/lib/security/validation';

// Use predefined schemas
const emailSchema = securitySchemas.email;
const safeTextSchema = securitySchemas.safeText;

// Create custom validation
const customSchema = z.object({
  email: securitySchemas.email,
  message: securitySchemas.safeText,
  phone: securitySchemas.phoneNumber,
});

// Validate in API route
const validation = await validateApiRequest(request, customSchema);
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
```

## 🔐 Security Best Practices

### Authentication & Authorization

1. **Always verify user permissions**:
```tsx
// In API routes
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Check resource ownership
const resource = await getResource(resourceId);
if (resource.userId !== userId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

2. **Use middleware for route protection**:
```tsx
// Routes are automatically protected via middleware.ts
// Protected routes: /dashboard/*, /api/user/*, etc.
```

### Data Protection

1. **Never log sensitive data**:
```tsx
// ❌ Don't do this
console.log('User data:', { email, password, creditCard });

// ✅ Do this instead
console.log('User action:', { userId: user.id, action: 'login' });
```

2. **Sanitize all user input**:
```tsx
import { securityValidators } from '@/lib/security/config';

const sanitized = securityValidators.sanitizeInput(userInput);
```

3. **Validate file uploads**:
```tsx
import { validateFileUpload } from '@/lib/security/validation';

const validation = validateFileUpload(file);
if (!validation.valid) {
  return { error: validation.error };
}
```

### API Security

1. **Use rate limiting for all endpoints**:
```tsx
// Automatic via middleware, or manual:
import { withRateLimit } from '@/lib/security/rate-limit';

export const POST = withRateLimit(async (request) => {
  // Your handler
}, { requests: 5, window: '1m' });
```

2. **Implement proper error handling**:
```tsx
try {
  // API logic
} catch (error) {
  // Log error internally
  console.error('API Error:', error);
  
  // Return generic error to client
  return NextResponse.json(
    { error: 'Something went wrong' },
    { status: 500 }
  );
}
```

### Content Security

1. **Use CSP-compliant inline styles**:
```tsx
// ❌ Avoid inline styles
<div style={{ color: 'red' }}>Text</div>

// ✅ Use CSS classes or CSS-in-JS
<div className="text-red-500">Text</div>
```

2. **Sanitize HTML content**:
```tsx
import { sanitizeHtml } from '@/lib/security/validation';

const safeHtml = sanitizeHtml(userGeneratedHtml);
```

## 🔍 Security Monitoring

### Audit Logging

Security events are automatically logged:
```tsx
import { logSecurityEvent, SecurityAuditLevel } from '@/lib/security/config';

logSecurityEvent(
  SecurityAuditLevel.WARNING,
  'Suspicious activity detected',
  { userId, action, ip }
);
```

### Performance Monitoring

Monitor security-related metrics:
- Rate limit violations
- Failed authentication attempts
- CSRF token validation failures
- Input validation rejections

### Regular Security Audits

Run the security audit script regularly:
```bash
# In CI/CD pipeline
npm run security:audit

# Manual execution
npx tsx scripts/security-audit.ts
```

## 🚨 Incident Response

### Security Incident Checklist

1. **Immediate Response**:
   - [ ] Identify the security incident type
   - [ ] Assess the scope and impact
   - [ ] Contain the incident if possible
   - [ ] Document all actions taken

2. **Investigation**:
   - [ ] Review audit logs for the incident timeframe
   - [ ] Check for data compromise
   - [ ] Identify the root cause
   - [ ] Assess affected systems and users

3. **Recovery**:
   - [ ] Patch the vulnerability
   - [ ] Reset compromised credentials
   - [ ] Update security configurations
   - [ ] Monitor for additional threats

4. **Post-Incident**:
   - [ ] Update security procedures
   - [ ] Improve monitoring and detection
   - [ ] Conduct team training if needed
   - [ ] Document lessons learned

### Common Vulnerabilities & Mitigations

| Vulnerability | Mitigation | Implementation |
|---------------|------------|----------------|
| **CSRF** | Token validation | `lib/security/csrf.ts` |
| **XSS** | Input sanitization, CSP | `lib/security/validation.ts` |
| **SQL Injection** | Parameterized queries, Drizzle ORM | Database layer |
| **Clickjacking** | X-Frame-Options header | `middleware.ts` |
| **MITM** | HTTPS enforcement, HSTS | `next.config.mjs` |
| **Rate Limiting** | Request throttling | `lib/security/rate-limit.ts` |

## 📚 Additional Resources

### Security Standards Compliance

- **OWASP Top 10**: All vulnerabilities addressed
- **PCI DSS**: Payment data protection via Stripe
- **GDPR**: Data protection and user rights
- **SOC 2**: Security controls implementation

### Security Testing Tools

- **Static Analysis**: ESLint security plugin
- **Dependency Scanning**: `npm audit`
- **Security Headers**: [securityheaders.com](https://securityheaders.com)
- **CSP Testing**: [csp-evaluator.withgoogle.com](https://csp-evaluator.withgoogle.com)

### Team Training

- Regular security awareness training
- Code review security checklists
- Incident response drills
- Security-first development practices

## 🆘 Support

For security-related questions or to report vulnerabilities:

1. **Internal Issues**: Use the security audit script and documentation
2. **Emergency Response**: Follow the incident response checklist
3. **Security Updates**: Monitor dependency vulnerabilities with `npm audit`
4. **Best Practices**: Refer to this guide and the CLAUDE.md standards

Remember: Security is everyone's responsibility. When in doubt, choose the more secure option and consult the team.

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: Security Team