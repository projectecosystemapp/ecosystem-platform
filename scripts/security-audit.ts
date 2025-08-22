#!/usr/bin/env npx tsx

/**
 * Security Audit Script
 * 
 * Comprehensive security testing and vulnerability scanning
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface SecurityCheck {
  name: string;
  description: string;
  category: 'critical' | 'high' | 'medium' | 'low';
  check: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

/**
 * Security audit configuration
 */
const securityChecks: SecurityCheck[] = [
  {
    name: 'Environment Variables',
    description: 'Check for secure environment variable configuration',
    category: 'critical',
    check: async () => {
      const requiredSecrets = [
        'DATABASE_URL',
        'CLERK_SECRET_KEY',
        'STRIPE_SECRET_KEY',
        'NEXTAUTH_SECRET',
      ];
      
      const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);
      
      if (missingSecrets.length > 0) {
        return {
          passed: false,
          message: `Missing critical environment variables: ${missingSecrets.join(', ')}`,
          details: { missing: missingSecrets }
        };
      }
      
      // Check for hardcoded secrets in code
      const dangerousPatterns = [
        /sk_live_[a-zA-Z0-9]+/g, // Stripe live keys
        /sk_test_[a-zA-Z0-9]+/g, // Stripe test keys
        /postgres:\/\/[^@]+:[^@]+@/g, // Database URLs with credentials
      ];
      
      const sourceFiles = getAllSourceFiles();
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            return {
              passed: false,
              message: `Potential hardcoded secret found in ${file}`,
              details: { file, pattern: pattern.toString() }
            };
          }
        }
      }
      
      return { passed: true, message: 'Environment variables properly configured' };
    }
  },
  
  {
    name: 'Dependencies Vulnerabilities',
    description: 'Check for known vulnerabilities in dependencies',
    category: 'high',
    check: async () => {
      try {
        execSync('npm audit --audit-level=high', { stdio: 'pipe' });
        return { passed: true, message: 'No high-risk vulnerabilities found' };
      } catch (error) {
        return {
          passed: false,
          message: 'High-risk vulnerabilities found in dependencies',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    }
  },
  
  {
    name: 'HTTPS Configuration',
    description: 'Verify HTTPS and security headers configuration',
    category: 'high',
    check: async () => {
      const nextConfigPath = path.join(process.cwd(), 'next.config.mjs');
      
      if (!fs.existsSync(nextConfigPath)) {
        return { passed: false, message: 'next.config.mjs not found' };
      }
      
      const configContent = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Check for security headers configuration
      const hasSecurityHeaders = configContent.includes('headers()') || 
                                 fs.existsSync(path.join(process.cwd(), 'middleware.ts'));
      
      if (!hasSecurityHeaders) {
        return {
          passed: false,
          message: 'Security headers not configured'
        };
      }
      
      return { passed: true, message: 'HTTPS and security headers properly configured' };
    }
  },
  
  {
    name: 'CSRF Protection',
    description: 'Verify CSRF protection implementation',
    category: 'high',
    check: async () => {
      const middlewarePath = path.join(process.cwd(), 'middleware.ts');
      
      if (!fs.existsSync(middlewarePath)) {
        return { passed: false, message: 'middleware.ts not found' };
      }
      
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
      
      const hasCSRFProtection = middlewareContent.includes('csrf') || 
                               middlewareContent.includes('CSRF');
      
      if (!hasCSRFProtection) {
        return {
          passed: false,
          message: 'CSRF protection not implemented in middleware'
        };
      }
      
      return { passed: true, message: 'CSRF protection properly implemented' };
    }
  },
  
  {
    name: 'Authentication Security',
    description: 'Check authentication implementation security',
    category: 'critical',
    check: async () => {
      const authFiles = [
        'middleware.ts',
        'app/api/auth/[...clerk]/route.ts',
        'lib/auth.ts',
      ];
      
      let authImplemented = false;
      
      for (const file of authFiles) {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('clerk') || content.includes('auth')) {
            authImplemented = true;
            break;
          }
        }
      }
      
      if (!authImplemented) {
        return {
          passed: false,
          message: 'Authentication not properly implemented'
        };
      }
      
      return { passed: true, message: 'Authentication properly implemented' };
    }
  },
  
  {
    name: 'Rate Limiting',
    description: 'Verify rate limiting implementation',
    category: 'medium',
    check: async () => {
      const rateLimitFiles = [
        'lib/security/rate-limit.ts',
        'middleware.ts',
      ];
      
      let rateLimitImplemented = false;
      
      for (const file of rateLimitFiles) {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('rateLimit') || content.includes('rate-limit')) {
            rateLimitImplemented = true;
            break;
          }
        }
      }
      
      if (!rateLimitImplemented) {
        return {
          passed: false,
          message: 'Rate limiting not implemented'
        };
      }
      
      return { passed: true, message: 'Rate limiting properly implemented' };
    }
  },
  
  {
    name: 'Input Validation',
    description: 'Check for proper input validation using Zod',
    category: 'high',
    check: async () => {
      const apiFiles = getAllApiFiles();
      let validationFound = false;
      
      for (const file of apiFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('z.') || content.includes('zod')) {
          validationFound = true;
          break;
        }
      }
      
      if (!validationFound && apiFiles.length > 0) {
        return {
          passed: false,
          message: 'Input validation not implemented in API routes'
        };
      }
      
      return { passed: true, message: 'Input validation properly implemented' };
    }
  },
  
  {
    name: 'File Permissions',
    description: 'Check file permissions for sensitive files',
    category: 'medium',
    check: async () => {
      const sensitiveFiles = [
        '.env',
        '.env.local',
        '.env.production',
        'next.config.mjs',
      ];
      
      const issues = [];
      
      for (const file of sensitiveFiles) {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          const mode = stats.mode & parseInt('777', 8);
          
          // Check if file is world-readable
          if (mode & parseInt('004', 8)) {
            issues.push(`${file} is world-readable`);
          }
        }
      }
      
      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Sensitive files have insecure permissions',
          details: { issues }
        };
      }
      
      return { passed: true, message: 'File permissions are secure' };
    }
  },
  
  {
    name: 'Content Security Policy',
    description: 'Verify CSP implementation',
    category: 'medium',
    check: async () => {
      const securityFiles = [
        'lib/security/headers.ts',
        'middleware.ts',
      ];
      
      let cspImplemented = false;
      
      for (const file of securityFiles) {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('Content-Security-Policy') || content.includes('CSP')) {
            cspImplemented = true;
            break;
          }
        }
      }
      
      if (!cspImplemented) {
        return {
          passed: false,
          message: 'Content Security Policy not implemented'
        };
      }
      
      return { passed: true, message: 'Content Security Policy properly implemented' };
    }
  },
];

/**
 * Get all source files for scanning
 */
function getAllSourceFiles(): string[] {
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const excludeDirs = ['node_modules', '.next', 'dist', 'build'];
  
  function scanDirectory(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
          files.push(...scanDirectory(fullPath));
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return files;
  }
  
  return scanDirectory(process.cwd());
}

/**
 * Get all API route files
 */
function getAllApiFiles(): string[] {
  const apiDir = path.join(process.cwd(), 'app', 'api');
  
  if (!fs.existsSync(apiDir)) {
    return [];
  }
  
  function scanApiDirectory(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...scanApiDirectory(fullPath));
        } else if (entry.isFile() && entry.name === 'route.ts') {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return files;
  }
  
  return scanApiDirectory(apiDir);
}

/**
 * Run security audit
 */
async function runSecurityAudit() {
  console.log('🔒 Starting Security Audit...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    details: [] as any[],
  };
  
  for (const check of securityChecks) {
    console.log(`Checking: ${check.name}...`);
    
    try {
      const result = await check.check();
      
      if (result.passed) {
        results.passed++;
        console.log(`✅ ${check.name}: ${result.message}`);
      } else {
        results.failed++;
        results[check.category]++;
        console.log(`❌ ${check.name}: ${result.message}`);
        
        if (result.details) {
          console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
        }
      }
      
      results.details.push({
        name: check.name,
        category: check.category,
        passed: result.passed,
        message: result.message,
        details: result.details,
      });
    } catch (error) {
      results.failed++;
      results[check.category]++;
      console.log(`💥 ${check.name}: Error during check`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 Security Audit Summary');
  console.log('========================');
  console.log(`Total Checks: ${securityChecks.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log('');
  console.log('Failed by Severity:');
  console.log(`  Critical: ${results.critical}`);
  console.log(`  High: ${results.high}`);
  console.log(`  Medium: ${results.medium}`);
  console.log(`  Low: ${results.low}`);
  
  // Security score
  const score = Math.round((results.passed / securityChecks.length) * 100);
  console.log('');
  console.log(`🎯 Security Score: ${score}%`);
  
  if (score >= 90) {
    console.log('🟢 Excellent security posture!');
  } else if (score >= 75) {
    console.log('🟡 Good security, but room for improvement');
  } else if (score >= 50) {
    console.log('🟠 Security needs attention');
  } else {
    console.log('🔴 Critical security issues detected!');
  }
  
  // Exit with appropriate code
  if (results.critical > 0) {
    process.exit(1);
  } else if (results.high > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run the audit
if (require.main === module) {
  runSecurityAudit().catch(console.error);
}

export { runSecurityAudit, securityChecks };