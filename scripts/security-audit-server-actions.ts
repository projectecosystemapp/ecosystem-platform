#!/usr/bin/env tsx

/**
 * SECURITY AUDIT: Server Actions Authentication & Authorization
 * 
 * This script audits all Server Actions for proper authentication and authorization
 * following Zero-Trust security principles.
 * 
 * Security Requirements:
 * 1. All actions must authenticate the user
 * 2. All sensitive operations must verify permissions
 * 3. All data access must be authorized
 * 4. All operations must have audit logging
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface SecurityIssue {
  file: string;
  line: number;
  function: string;
  issue: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

interface ActionAuditResult {
  file: string;
  functions: {
    name: string;
    hasAuth: boolean;
    hasPermissionCheck: boolean;
    hasTryCatch: boolean;
    hasAuditLog: boolean;
    hasRateLimit: boolean;
    issues: string[];
  }[];
}

class ServerActionSecurityAuditor {
  private issues: SecurityIssue[] = [];
  private results: ActionAuditResult[] = [];

  // Patterns to detect security checks
  private patterns = {
    authCheck: /const\s+{\s*userId\s*}\s*=\s*(await\s+)?auth\(\)/,
    authValidation: /if\s*\(\s*!userId\s*\)/,
    permissionCheck: /userId\s*!==|userId\s*===|provider\.userId|owner\.userId|customerId\s*===\s*userId/,
    tryCatch: /try\s*{[\s\S]*?}\s*catch/,
    auditLog: /console\.log.*userId|log.*action|audit/i,
    rateLimit: /rateLimit|throttle/i,
    sensitiveOps: /stripe|payment|refund|transfer|payout|booking|cancel|complete|delete|update/i,
    dataValidation: /zod|schema\.parse|validate/i,
  };

  public async auditServerActions(directory: string): Promise<void> {
    console.log('🔒 Starting Server Actions Security Audit...\n');
    
    const actionFiles = this.findServerActionFiles(directory);
    
    for (const file of actionFiles) {
      await this.auditFile(file);
    }
    
    this.generateReport();
  }

  private findServerActionFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scanDir = (currentDir: string) => {
      const entries = readdirSync(currentDir);
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          scanDir(fullPath);
        } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.includes('"use server"') || content.includes("'use server'")) {
            files.push(fullPath);
          }
        }
      }
    };
    
    scanDir(dir);
    return files;
  }

  private async auditFile(filePath: string): Promise<void> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Extract all exported async functions
    const functions = this.extractServerActions(content);
    
    const result: ActionAuditResult = {
      file: filePath,
      functions: [],
    };
    
    for (const func of functions) {
      const funcAudit = this.auditFunction(func, content, lines, filePath);
      result.functions.push(funcAudit);
    }
    
    this.results.push(result);
  }

  private extractServerActions(content: string): { name: string; body: string; startLine: number }[] {
    const functions: { name: string; body: string; startLine: number }[] = [];
    const lines = content.split('\n');
    
    // Pattern to match exported async functions
    const funcPattern = /export\s+async\s+function\s+(\w+)/g;
    let match;
    
    while ((match = funcPattern.exec(content)) !== null) {
      const funcName = match[1];
      const funcStart = match.index;
      
      // Find the function body
      let braceCount = 0;
      let funcEnd = funcStart;
      let inFunction = false;
      
      for (let i = funcStart; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
          inFunction = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            funcEnd = i + 1;
            break;
          }
        }
      }
      
      const funcBody = content.substring(funcStart, funcEnd);
      const startLine = content.substring(0, funcStart).split('\n').length;
      
      functions.push({
        name: funcName,
        body: funcBody,
        startLine,
      });
    }
    
    return functions;
  }

  private auditFunction(
    func: { name: string; body: string; startLine: number },
    fullContent: string,
    lines: string[],
    filePath: string
  ): ActionAuditResult['functions'][0] {
    const funcBody = func.body;
    const isSensitive = this.patterns.sensitiveOps.test(funcBody);
    
    const hasAuth = this.patterns.authCheck.test(funcBody);
    const hasAuthValidation = this.patterns.authValidation.test(funcBody);
    const hasPermissionCheck = this.patterns.permissionCheck.test(funcBody);
    const hasTryCatch = this.patterns.tryCatch.test(funcBody);
    const hasAuditLog = this.patterns.auditLog.test(funcBody);
    const hasRateLimit = this.patterns.rateLimit.test(funcBody);
    const hasDataValidation = this.patterns.dataValidation.test(funcBody);
    
    const issues: string[] = [];
    
    // Check for missing authentication
    if (!hasAuth) {
      this.addIssue({
        file: filePath,
        line: func.startLine,
        function: func.name,
        issue: 'Missing authentication check',
        severity: 'CRITICAL',
        recommendation: 'Add: const { userId } = await auth(); if (!userId) return { error: "Unauthorized" };',
      });
      issues.push('No authentication');
    } else if (!hasAuthValidation) {
      this.addIssue({
        file: filePath,
        line: func.startLine,
        function: func.name,
        issue: 'Authentication not validated',
        severity: 'HIGH',
        recommendation: 'Add validation: if (!userId) return { error: "Unauthorized" };',
      });
      issues.push('Auth not validated');
    }
    
    // Check for permission checks on sensitive operations
    if (isSensitive && !hasPermissionCheck && hasAuth) {
      this.addIssue({
        file: filePath,
        line: func.startLine,
        function: func.name,
        issue: 'Missing permission verification for sensitive operation',
        severity: 'HIGH',
        recommendation: 'Verify user owns the resource before allowing modifications',
      });
      issues.push('No permission check');
    }
    
    // Check for error handling
    if (!hasTryCatch) {
      this.addIssue({
        file: filePath,
        line: func.startLine,
        function: func.name,
        issue: 'Missing error handling',
        severity: 'MEDIUM',
        recommendation: 'Wrap function body in try-catch block',
      });
      issues.push('No error handling');
    }
    
    // Check for audit logging on sensitive operations
    if (isSensitive && !hasAuditLog) {
      this.addIssue({
        file: filePath,
        line: func.startLine,
        function: func.name,
        issue: 'Missing audit logging for sensitive operation',
        severity: 'MEDIUM',
        recommendation: 'Add audit logging for security-relevant operations',
      });
      issues.push('No audit logging');
    }
    
    // Check for rate limiting on public or expensive operations
    if (!hasRateLimit && (func.name.includes('create') || func.name.includes('send'))) {
      this.addIssue({
        file: filePath,
        line: func.startLine,
        function: func.name,
        issue: 'Missing rate limiting',
        severity: 'MEDIUM',
        recommendation: 'Implement rate limiting to prevent abuse',
      });
      issues.push('No rate limiting');
    }
    
    // Check for input validation
    if (!hasDataValidation && funcBody.includes('data')) {
      this.addIssue({
        file: filePath,
        line: func.startLine,
        function: func.name,
        issue: 'Missing input validation',
        severity: 'HIGH',
        recommendation: 'Use Zod schemas to validate all user input',
      });
      issues.push('No input validation');
    }
    
    return {
      name: func.name,
      hasAuth: hasAuth && hasAuthValidation,
      hasPermissionCheck,
      hasTryCatch,
      hasAuditLog,
      hasRateLimit,
      issues,
    };
  }

  private addIssue(issue: SecurityIssue): void {
    this.issues.push(issue);
  }

  private generateReport(): void {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                  SERVER ACTIONS SECURITY AUDIT REPORT               ');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // Summary statistics
    const totalFunctions = this.results.reduce((sum, r) => sum + r.functions.length, 0);
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL').length;
    const highIssues = this.issues.filter(i => i.severity === 'HIGH').length;
    const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM').length;
    const lowIssues = this.issues.filter(i => i.severity === 'LOW').length;
    
    console.log('📊 SUMMARY');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`Total Server Actions: ${totalFunctions}`);
    console.log(`Total Issues Found: ${this.issues.length}`);
    console.log(`  🔴 Critical: ${criticalIssues}`);
    console.log(`  🟠 High: ${highIssues}`);
    console.log(`  🟡 Medium: ${mediumIssues}`);
    console.log(`  🟢 Low: ${lowIssues}`);
    console.log();
    
    // Critical issues that need immediate attention
    if (criticalIssues > 0) {
      console.log('🚨 CRITICAL SECURITY ISSUES (Fix Immediately)');
      console.log('─────────────────────────────────────────────────────────────────');
      this.issues
        .filter(i => i.severity === 'CRITICAL')
        .forEach(issue => {
          console.log(`\n📁 ${issue.file}`);
          console.log(`   Function: ${issue.function} (line ${issue.line})`);
          console.log(`   ❌ ${issue.issue}`);
          console.log(`   ✅ Fix: ${issue.recommendation}`);
        });
      console.log();
    }
    
    // High severity issues
    if (highIssues > 0) {
      console.log('⚠️  HIGH SEVERITY ISSUES');
      console.log('─────────────────────────────────────────────────────────────────');
      this.issues
        .filter(i => i.severity === 'HIGH')
        .forEach(issue => {
          console.log(`\n📁 ${issue.file}`);
          console.log(`   Function: ${issue.function} (line ${issue.line})`);
          console.log(`   ⚠️  ${issue.issue}`);
          console.log(`   ✅ Fix: ${issue.recommendation}`);
        });
      console.log();
    }
    
    // File-by-file breakdown
    console.log('📋 DETAILED ANALYSIS BY FILE');
    console.log('─────────────────────────────────────────────────────────────────');
    
    for (const result of this.results) {
      const fileName = result.file.split('/').pop();
      const fileIssues = this.issues.filter(i => i.file === result.file);
      
      console.log(`\n📁 ${fileName}`);
      console.log(`   Total Functions: ${result.functions.length}`);
      console.log(`   Issues: ${fileIssues.length}`);
      
      for (const func of result.functions) {
        const status = func.issues.length === 0 ? '✅' : '❌';
        console.log(`   ${status} ${func.name}()`);
        
        if (func.issues.length > 0) {
          func.issues.forEach(issue => {
            console.log(`      - ${issue}`);
          });
        }
      }
    }
    
    // Recommendations
    console.log('\n\n🔐 SECURITY RECOMMENDATIONS');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('1. Implement a centralized authentication wrapper for all Server Actions');
    console.log('2. Add rate limiting middleware for all public-facing actions');
    console.log('3. Implement comprehensive audit logging for all sensitive operations');
    console.log('4. Use Zod schemas for all input validation');
    console.log('5. Add permission checks for all resource modifications');
    console.log('6. Implement database transaction rollback on errors');
    console.log('7. Add security headers to all responses');
    console.log('8. Implement CSRF protection for state-changing operations');
    
    // Exit code based on severity
    if (criticalIssues > 0) {
      console.log('\n❌ AUDIT FAILED: Critical security issues found!');
      process.exit(1);
    } else if (highIssues > 0) {
      console.log('\n⚠️  AUDIT WARNING: High severity issues found');
      process.exit(0);
    } else {
      console.log('\n✅ AUDIT PASSED: No critical issues found');
      process.exit(0);
    }
  }
}

// Run the audit
const auditor = new ServerActionSecurityAuditor();
auditor.auditServerActions(join(process.cwd(), 'actions'));