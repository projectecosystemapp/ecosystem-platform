#!/usr/bin/env node

/**
 * Simple Sentry Setup Validator
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

function main() {
  console.log('\n🛡️  Sentry Setup Validator\n');
  
  // Check required files
  console.log('📁 Checking Sentry files...\n');
  
  const files = [
    'sentry.client.config.ts',
    'sentry.server.config.ts', 
    'sentry.edge.config.ts',
    'lib/ai/telemetry-config.ts'
  ];
  
  let allFilesExist = true;
  files.forEach(file => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filePath)) {
      console.log('✅', file);
    } else {
      console.log('❌', file, '(missing)');
      allFilesExist = false;
    }
  });
  
  // Check environment variables
  console.log('\n🔧 Checking environment variables...\n');
  
  const envPath = path.join(PROJECT_ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local not found');
    console.log('   Copy .env.example to .env.local to get started\n');
  } else {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const requiredVars = [
      'NEXT_PUBLIC_SENTRY_DSN',
      'SENTRY_DSN', 
      'SENTRY_ORG',
      'SENTRY_PROJECT'
    ];
    
    let hasAllVars = true;
    requiredVars.forEach(varName => {
      const hasVar = envContent.includes(varName) && !envContent.includes(`${varName}=\n`);
      if (hasVar) {
        console.log('✅', varName);
      } else {
        console.log('❌', varName, '(missing or empty)');
        hasAllVars = false;
      }
    });
    
    if (!hasAllVars) {
      console.log('\n📖 Setup Instructions:');
      console.log('1. Go to https://sentry.io/ and create a project');
      console.log('2. Copy the DSN from your project settings');
      console.log('3. Add the DSN to your .env.local file');
      console.log('4. Set SENTRY_ORG and SENTRY_PROJECT values');
    }
  }
  
  // Next steps
  console.log('\n🚀 Next Steps:\n');
  
  if (allFilesExist) {
    console.log('✅ All Sentry files are present');
  } else {
    console.log('❌ Some Sentry files are missing');
  }
  
  console.log('\nTo test your Sentry integration:');
  console.log('1. npm run dev');
  console.log('2. Trigger errors in your application'); 
  console.log('3. Check browser console (dev) or Sentry dashboard (prod)');
  
  console.log('\n✨ Setup validation complete!\n');
}

if (require.main === module) {
  main();
}