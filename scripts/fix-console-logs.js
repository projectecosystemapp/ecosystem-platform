#!/usr/bin/env node

/**
 * Script to automatically replace console.log and console.error statements
 * with proper structured logging in API routes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript files in app/api directory
const apiDir = path.join(__dirname, '..', 'app', 'api');

function findApiFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findApiFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }
  
  return files;
}

function hasConsoleStatements(content) {
  return /console\.(log|error|warn|info)/.test(content);
}

function addImportIfNeeded(content) {
  if (content.includes('logApiStart')) {
    return content; // Already has the import
  }
  
  // Find existing imports and add our import
  const lines = content.split('\n');
  let importInserted = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for existing rate-limit import to add after it
    if (line.includes('from "@/lib/rate-limit') || line.includes('from "@/lib/auth/')) {
      lines.splice(i + 1, 0, 'import { logApiStart, logApiSuccess, logApiError } from "@/lib/logger";');
      importInserted = true;
      break;
    }
    
    // Or add after any lib import
    if (!importInserted && line.includes('from "@/lib/') && !line.includes('logger')) {
      lines.splice(i + 1, 0, 'import { logApiStart, logApiSuccess, logApiError } from "@/lib/logger";');
      importInserted = true;
      break;
    }
  }
  
  // If no suitable place found, add after the last import
  if (!importInserted) {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('import') && lines[i].trim() !== '') {
        lines.splice(i, 0, 'import { logApiStart, logApiSuccess, logApiError } from "@/lib/logger";', '');
        break;
      }
    }
  }
  
  return lines.join('\n');
}

function fixConsoleStatements(content) {
  // Replace console.error patterns in catch blocks
  content = content.replace(
    /(\s+)console\.error\(["']([^"']+)["'],\s*error\);/g,
    (match, indent, message) => {
      const loggerVar = 'logger' + Math.random().toString(36).substr(2, 5);
      const routePath = extractRoutePath(content) || '/api/unknown';
      const method = extractMethod(content) || 'POST';
      
      return `${indent}const ${loggerVar} = logApiStart("${routePath}", "${method}");\n${indent}logApiError(${loggerVar}, "${message}", error as Error);`;
    }
  );
  
  // Replace console.log success patterns
  content = content.replace(
    /(\s+)console\.log\([^)]+\{[^}]*\}\);/g,
    (match, indent) => {
      const loggerVar = 'logger' + Math.random().toString(36).substr(2, 5);
      const routePath = extractRoutePath(content) || '/api/unknown';
      const method = extractMethod(content) || 'POST';
      
      return `${indent}const ${loggerVar} = logApiStart("${routePath}", "${method}");\n${indent}logApiSuccess(${loggerVar}, "Operation completed successfully", {});`;
    }
  );
  
  return content;
}

function extractRoutePath(content) {
  // Try to extract route path from file structure or comments
  const pathMatch = content.match(/\/\*\*[\s\S]*?\*\s*([A-Z]+)\s+([\/\w\-\[\]]+)/);
  if (pathMatch && pathMatch[2]) {
    return pathMatch[2];
  }
  return null;
}

function extractMethod(content) {
  // Try to extract HTTP method
  const methodMatch = content.match(/export\s+const\s+(GET|POST|PUT|DELETE|PATCH)/);
  if (methodMatch) {
    return methodMatch[1];
  }
  return 'POST';
}

function processFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!hasConsoleStatements(content)) {
      console.log(`  ✓ No console statements found`);
      return;
    }
    
    console.log(`  → Found console statements, fixing...`);
    
    // Add import if needed
    content = addImportIfNeeded(content);
    
    // Fix console statements
    const originalContent = content;
    content = fixConsoleStatements(content);
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ Fixed console statements`);
    } else {
      console.log(`  ⚠ No changes made`);
    }
    
  } catch (error) {
    console.error(`  ✗ Error processing file: ${error.message}`);
  }
}

function main() {
  console.log('🔍 Finding API route files...\n');
  
  const apiFiles = findApiFiles(apiDir);
  console.log(`Found ${apiFiles.length} API route files\n`);
  
  console.log('🔧 Processing files...\n');
  
  for (const file of apiFiles) {
    processFile(file);
  }
  
  console.log('\n✅ Processing complete!');
  
  // Check remaining console statements
  try {
    const result = execSync('find app/api -name "*.ts" -exec grep -l "console\\." {} \\; | wc -l', 
      { encoding: 'utf8', cwd: path.join(__dirname, '..') });
    const remaining = parseInt(result.trim());
    console.log(`\n📊 Remaining files with console statements: ${remaining}`);
  } catch (error) {
    console.log('\n⚠ Could not count remaining console statements');
  }
}

if (require.main === module) {
  main();
}