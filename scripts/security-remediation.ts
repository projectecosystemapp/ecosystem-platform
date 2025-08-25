#!/usr/bin/env tsx
/**
 * Security Remediation Script
 * Implements immediate fixes for critical vulnerabilities
 * 
 * Run: npx tsx scripts/security-remediation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================================================
// REMEDIATION 1: Generate secure CSRF secret
// ============================================================================
function generateCSRFSecret() {
  log('\n🔐 Generating secure CSRF secret...', 'blue');
  
  const secret = crypto.randomBytes(64).toString('hex');
  const envPath = path.join(process.cwd(), '.env.local');
  
  try {
    let envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Check if CSRF_SECRET exists
    if (envContent.includes('CSRF_SECRET=')) {
      envContent = envContent.replace(/CSRF_SECRET=.*/g, `CSRF_SECRET=${secret}`);
    } else {
      envContent += `\n# Security - CSRF Protection\nCSRF_SECRET=${secret}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    log('✅ CSRF secret generated and saved to .env.local', 'green');
    log('   Please update your production environment variables!', 'yellow');
  } catch (error) {
    log('❌ Failed to update .env.local', 'red');
    console.error(error);
  }
}

// ============================================================================
// REMEDIATION 2: Update CSRF implementation to require secret
// ============================================================================
function updateCSRFImplementation() {
  log('\n🔧 Updating CSRF implementation...', 'blue');
  
  const csrfPath = path.join(process.cwd(), 'lib/security/csrf.ts');
  
  const updatedContent = `/**
 * CSRF Protection Utilities - SECURED VERSION
 * 
 * Provides CSRF token generation, validation, and management
 * for protecting against Cross-Site Request Forgery attacks
 */

import crypto from 'crypto';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;

// Require CSRF_SECRET from environment
const CSRF_SECRET = process.env.CSRF_SECRET;
if (!CSRF_SECRET || CSRF_SECRET.length < 32) {
  throw new Error(
    'CSRF_SECRET environment variable is required and must be at least 32 characters. ' +
    'Generate one with: openssl rand -hex 32'
  );
}

const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a signed CSRF token with timestamp
 */
export function createSignedToken(token: string): string {
  const timestamp = Date.now();
  const data = \`\${token}.\${timestamp}\`;
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(data)
    .digest('hex');
  return \`\${data}.\${signature}\`;
}

/**
 * Verify a signed CSRF token with constant-time comparison
 */
export function verifySignedToken(signedToken: string, maxAge: number = 86400000): boolean {
  try {
    const parts = signedToken.split('.');
    if (parts.length !== 3) return false;

    const [token, timestamp, signature] = parts;
    const data = \`\${token}.\${timestamp}\`;
    
    // Verify signature with constant-time comparison
    const expectedSignature = crypto
      .createHmac('sha256', CSRF_SECRET)
      .update(data)
      .digest('hex');
    
    // Use timing-safe comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )) {
      return false;
    }
    
    // Check token age
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > maxAge) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract CSRF token from headers or body
 */
export function extractCSRFToken(request: Request): string | null {
  // Check header first (preferred method)
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) return headerToken;
  
  // Check body for form submissions
  const contentType = request.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    // For JSON requests, the token would be in the body
    // This would need to be parsed in the middleware
    return null;
  }
  
  return null;
}

/**
 * CSRF token cookie options for production
 */
export const csrfCookieOptions = {
  name: CSRF_COOKIE_NAME,
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 86400, // 24 hours
};

/**
 * Check if a request method requires CSRF protection
 */
export function requiresCSRFProtection(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  return !safeMethods.includes(method.toUpperCase());
}

/**
 * Check if a route should skip CSRF protection
 */
export function shouldSkipCSRF(pathname: string): boolean {
  const skipPaths = [
    '/api/stripe/webhooks',
    '/api/stripe/connect/webhooks',
    '/api/health',
    '/api/public',
  ];
  
  return skipPaths.some(path => pathname.startsWith(path));
}

/**
 * Generate CSRF meta tag for HTML pages
 */
export function generateCSRFMetaTag(token: string): string {
  return \`<meta name="csrf-token" content="\${token}">\`;
}

/**
 * Client-side helper to get CSRF token from meta tag
 */
export function getCSRFTokenFromMeta(): string | null {
  if (typeof window === 'undefined') return null;
  
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || null;
}

/**
 * Add CSRF token to fetch requests
 */
export function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getCSRFTokenFromMeta();
  
  if (!token) {
    console.warn('No CSRF token found for request to:', url);
  }
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
}
`;

  try {
    fs.writeFileSync(csrfPath, updatedContent);
    log('✅ CSRF implementation updated with security fixes', 'green');
  } catch (error) {
    log('❌ Failed to update CSRF implementation', 'red');
    console.error(error);
  }
}

// ============================================================================
// REMEDIATION 3: Create secure guest identifier function
// ============================================================================
function createSecureGuestIdentifier() {
  log('\n🔐 Creating secure guest identifier implementation...', 'blue');
  
  const content = `/**
 * Secure Guest Identifier Service
 * Uses bcrypt for one-way hashing of guest emails
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12; // Increased from default 10 for better security

/**
 * Create a secure, one-way hash of guest email
 * Uses bcrypt to prevent rainbow table attacks
 */
export async function createSecureGuestIdentifier(email: string): Promise<string> {
  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();
  
  // Add application-specific pepper (stored in env)
  const pepper = process.env.GUEST_EMAIL_PEPPER;
  if (!pepper) {
    throw new Error('GUEST_EMAIL_PEPPER environment variable is required');
  }
  
  // Combine email with pepper
  const pepperedEmail = \`\${normalizedEmail}:\${pepper}\`;
  
  // Generate secure hash
  const hash = await bcrypt.hash(pepperedEmail, SALT_ROUNDS);
  
  // Return URL-safe version
  return Buffer.from(hash).toString('base64url').substring(0, 32);
}

/**
 * Verify a guest email against stored identifier
 */
export async function verifyGuestIdentifier(
  email: string, 
  storedIdentifier: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const pepper = process.env.GUEST_EMAIL_PEPPER;
  
  if (!pepper) {
    throw new Error('GUEST_EMAIL_PEPPER environment variable is required');
  }
  
  const pepperedEmail = \`\${normalizedEmail}:\${pepper}\`;
  
  // Decode the stored identifier
  const hash = Buffer.from(storedIdentifier, 'base64url').toString();
  
  // Verify using bcrypt
  return bcrypt.compare(pepperedEmail, hash);
}

/**
 * Generate a secure confirmation code for bookings
 */
export function generateSecureConfirmationCode(): string {
  // Generate 8 character alphanumeric code
  const bytes = crypto.randomBytes(6);
  return bytes.toString('base64url').substring(0, 8).toUpperCase();
}
`;

  const filePath = path.join(process.cwd(), 'lib/security/guest-identifier.ts');
  
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content);
    log('✅ Secure guest identifier implementation created', 'green');
    
    // Add pepper to env
    const pepper = crypto.randomBytes(32).toString('hex');
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    
    if (!envContent.includes('GUEST_EMAIL_PEPPER=')) {
      envContent += `\n# Security - Guest Email Protection\nGUEST_EMAIL_PEPPER=${pepper}\n`;
      fs.writeFileSync(envPath, envContent);
      log('✅ Guest email pepper added to .env.local', 'green');
    }
  } catch (error) {
    log('❌ Failed to create guest identifier implementation', 'red');
    console.error(error);
  }
}

// ============================================================================
// REMEDIATION 4: Add .env.local to .gitignore
// ============================================================================
function updateGitignore() {
  log('\n📝 Updating .gitignore...', 'blue');
  
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  
  try {
    let content = fs.readFileSync(gitignorePath, 'utf-8');
    
    const linesToAdd = [
      '.env.local',
      '.env.production',
      '.env*.local',
      '*.pem',
      '*.key',
      'secrets/',
      '.secrets'
    ];
    
    let updated = false;
    for (const line of linesToAdd) {
      if (!content.includes(line)) {
        content += `\n${line}`;
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(gitignorePath, content);
      log('✅ .gitignore updated with security entries', 'green');
    } else {
      log('✅ .gitignore already contains security entries', 'green');
    }
  } catch (error) {
    log('❌ Failed to update .gitignore', 'red');
    console.error(error);
  }
}

// ============================================================================
// REMEDIATION 5: Install security dependencies
// ============================================================================
function installSecurityDependencies() {
  log('\n📦 Installing security dependencies...', 'blue');
  
  const dependencies = [
    'bcrypt',
    '@types/bcrypt',
    'helmet',
    'express-rate-limit',
    'express-mongo-sanitize',
    'xss',
    'hpp'
  ];
  
  try {
    log('Installing: ' + dependencies.join(', '), 'yellow');
    execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit' });
    log('✅ Security dependencies installed', 'green');
  } catch (error) {
    log('❌ Failed to install dependencies', 'red');
    log('   Please run manually: npm install ' + dependencies.join(' '), 'yellow');
  }
}

// ============================================================================
// REMEDIATION 6: Create security monitoring setup
// ============================================================================
function createSecurityMonitoring() {
  log('\n📊 Creating security monitoring setup...', 'blue');
  
  const content = `/**
 * Security Monitoring and Alerting Service
 * Tracks and alerts on security events
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export enum SecurityEventType {
  AUTH_FAILURE = 'AUTH_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID',
  PAYMENT_ANOMALY = 'PAYMENT_ANOMALY',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT'
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class SecurityMonitor {
  private alerts: Map<string, number> = new Map();
  private readonly ALERT_THRESHOLD = 5;
  private readonly ALERT_WINDOW = 300000; // 5 minutes

  async logEvent(event: SecurityEvent): Promise<void> {
    // Log to database
    try {
      await db.execute(sql\`
        INSERT INTO security_events (
          type, severity, user_id, ip, user_agent, 
          path, method, timestamp, metadata
        ) VALUES (
          \${event.type}, \${event.severity}, \${event.userId || null},
          \${event.ip}, \${event.userAgent}, \${event.path},
          \${event.method}, \${event.timestamp}, \${JSON.stringify(event.metadata || {})}
        )
      \`);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }

    // Check for alert conditions
    await this.checkAlertConditions(event);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🚨 Security Event:', event);
    }
  }

  private async checkAlertConditions(event: SecurityEvent): Promise<void> {
    const key = \`\${event.type}:\${event.ip}\`;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, time] of this.alerts.entries()) {
      if (now - time > this.ALERT_WINDOW) {
        this.alerts.delete(k);
      }
    }

    // Track this event
    const count = Array.from(this.alerts.entries())
      .filter(([k]) => k === key)
      .length;

    this.alerts.set(\`\${key}:\${now}\`, now);

    // Check threshold
    if (count >= this.ALERT_THRESHOLD) {
      await this.sendAlert(event, count);
    }

    // Immediate alert for critical events
    if (event.severity === 'critical') {
      await this.sendAlert(event, 1);
    }
  }

  private async sendAlert(event: SecurityEvent, count: number): Promise<void> {
    // In production, this would send to:
    // - Slack/Discord webhook
    // - PagerDuty
    // - Email to security team
    // - SIEM system

    console.error('🚨🚨🚨 SECURITY ALERT 🚨🚨🚨');
    console.error(\`Type: \${event.type}\`);
    console.error(\`Severity: \${event.severity}\`);
    console.error(\`IP: \${event.ip}\`);
    console.error(\`Count: \${count} events in \${this.ALERT_WINDOW / 1000} seconds\`);
    console.error('Metadata:', event.metadata);

    // TODO: Implement actual alerting
    // await sendSlackAlert({ ... });
    // await sendEmail({ ... });
  }

  async getRecentEvents(
    minutes: number = 60,
    type?: SecurityEventType
  ): Promise<any[]> {
    const since = new Date(Date.now() - minutes * 60000);
    
    let query = sql\`
      SELECT * FROM security_events 
      WHERE timestamp > \${since}
    \`;

    if (type) {
      query = sql\`
        SELECT * FROM security_events 
        WHERE timestamp > \${since} AND type = \${type}
      \`;
    }

    query = sql\`\${query} ORDER BY timestamp DESC LIMIT 100\`;

    const results = await db.execute(query);
    return results.rows;
  }
}

export const securityMonitor = new SecurityMonitor();
`;

  const filePath = path.join(process.cwd(), 'lib/security/monitoring.ts');
  
  try {
    fs.writeFileSync(filePath, content);
    log('✅ Security monitoring service created', 'green');
  } catch (error) {
    log('❌ Failed to create security monitoring', 'red');
    console.error(error);
  }
}

// ============================================================================
// Main execution
// ============================================================================
async function main() {
  log('========================================', 'blue');
  log('   SECURITY REMEDIATION SCRIPT', 'blue');
  log('========================================', 'blue');
  log('\nThis script will implement critical security fixes\n', 'yellow');

  // Run all remediations
  generateCSRFSecret();
  updateCSRFImplementation();
  createSecureGuestIdentifier();
  updateGitignore();
  createSecurityMonitoring();
  installSecurityDependencies();

  log('\n========================================', 'green');
  log('   REMEDIATION COMPLETE', 'green');
  log('========================================', 'green');
  
  log('\n⚠️  IMPORTANT NEXT STEPS:', 'yellow');
  log('1. Review and test all changes', 'yellow');
  log('2. Update production environment variables', 'yellow');
  log('3. Deploy security fixes immediately', 'yellow');
  log('4. Rotate all API keys and secrets', 'yellow');
  log('5. Run security tests: npm run test:security', 'yellow');
  log('6. Monitor security events closely', 'yellow');
  
  log('\n📚 See SECURITY_AUDIT_REPORT.md for full details', 'blue');
}

// Run the script
main().catch(error => {
  log('\n❌ Script failed:', 'red');
  console.error(error);
  process.exit(1);
});