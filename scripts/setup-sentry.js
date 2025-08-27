#!/usr/bin/env node

/**
 * Sentry Setup Script
 * 
 * Guides through Sentry project setup and validates configuration
 */

const fs = require('fs');
const path = require('path');

// Simple console colors without external dependencies
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  white: (text) => `\x1b[37m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
};

const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, '.env.local');
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, '.env.example');

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(colors.green('✅'), `${description} exists`);
    return true;
  } else {
    console.log(colors.red('❌'), `${description} missing`);
    return false;
  }
}

function checkSentryFiles() {
  console.log(colors.blue('\n🔍 Checking Sentry configuration files...\n'));
  
  const files = [
    { path: 'sentry.client.config.ts', desc: 'Client config' },
    { path: 'sentry.server.config.ts', desc: 'Server config' },
    { path: 'sentry.edge.config.ts', desc: 'Edge config' },
    { path: 'app/sentry-example-page/page.tsx', desc: 'Test page' },
    { path: 'lib/ai/telemetry-config.ts', desc: 'AI telemetry config' },
    { path: 'app/api/test/sentry-ai/route.ts', desc: 'AI test endpoint' },
  ];
  
  let allGood = true;
  files.forEach(file => {
    const exists = checkFile(path.join(PROJECT_ROOT, file.path), file.desc);
    if (!exists) allGood = false;
  });
  
  return allGood;
}

function checkEnvironmentVariables() {
  console.log(colors.blue('\n🔍 Checking environment variables...\n'));
  
  // Check if .env.local exists
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    console.log(colors.yellow('⚠️'), '.env.local not found');
    console.log(colors.gray('   Copy .env.example to .env.local to get started'));
    return false;
  }
  
  // Read .env.local
  const envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
  
  const requiredVars = [
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_DSN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
  ];
  
  const optionalVars = [
    'SENTRY_AUTH_TOKEN',
  ];
  
  let hasRequired = true;
  
  console.log(chalk.white('Required variables:'));
  requiredVars.forEach(varName => {
    const hasVar = envContent.includes(varName) && !envContent.includes(`${varName}=\n`);
    if (hasVar) {
      console.log(chalk.green('✅'), varName);
    } else {
      console.log(chalk.red('❌'), varName, chalk.gray('(missing or empty)'));
      hasRequired = false;
    }
  });
  
  console.log(chalk.white('\nOptional variables:'));
  optionalVars.forEach(varName => {
    const hasVar = envContent.includes(varName) && !envContent.includes(`${varName}=\n`);
    if (hasVar) {
      console.log(chalk.green('✅'), varName);
    } else {
      console.log(chalk.yellow('⚠️'), varName, chalk.gray('(recommended for production)'));
    }
  });
  
  return hasRequired;
}

function printSetupInstructions() {
  console.log(chalk.blue('\n📖 Sentry Setup Instructions\n'));
  
  console.log(chalk.white('1. Create a Sentry project:'));
  console.log(chalk.gray('   • Go to https://sentry.io/'));
  console.log(chalk.gray('   • Create an account or sign in'));
  console.log(chalk.gray('   • Create a new project'));
  console.log(chalk.gray('   • Select "Next.js" as the platform'));
  console.log(chalk.gray('   • Copy the DSN from the project settings'));
  
  console.log(chalk.white('\n2. Configure environment variables:'));
  console.log(chalk.gray('   • Copy .env.example to .env.local'));
  console.log(chalk.gray('   • Set NEXT_PUBLIC_SENTRY_DSN=your-dsn-here'));
  console.log(chalk.gray('   • Set SENTRY_DSN=your-dsn-here'));
  console.log(chalk.gray('   • Set SENTRY_ORG=your-org-slug'));
  console.log(chalk.gray('   • Set SENTRY_PROJECT=your-project-slug'));
  
  console.log(chalk.white('\n3. Test the integration:'));
  console.log(chalk.gray('   • Run: npm run dev'));
  console.log(chalk.gray('   • Visit: http://localhost:3000/sentry-example-page'));
  console.log(chalk.gray('   • Click the test buttons'));
  console.log(chalk.gray('   • Check your Sentry dashboard for events'));
  
  console.log(chalk.white('\n4. Production setup:'));
  console.log(chalk.gray('   • Get an auth token from Sentry (for source maps)'));
  console.log(chalk.gray('   • Set SENTRY_AUTH_TOKEN in production environment'));
  console.log(chalk.gray('   • Deploy and test error reporting'));
}

function printNextSteps(filesOk, envOk) {
  console.log(chalk.blue('\n🚀 Next Steps\n'));
  
  if (!filesOk) {
    console.log(chalk.red('❌ Missing configuration files'));
    console.log(chalk.gray('   Run the setup script again or check file permissions'));
    return;
  }
  
  if (!envOk) {
    console.log(chalk.yellow('⚠️  Environment variables need configuration'));
    console.log(chalk.gray('   Follow the setup instructions above'));
    return;
  }
  
  console.log(chalk.green('✅ Sentry is configured and ready to test!'));
  console.log(chalk.white('\nTo test your setup:'));
  console.log(chalk.cyan('   npm run dev'));
  console.log(chalk.cyan('   # Open http://localhost:3000/sentry-example-page'));
  console.log(chalk.cyan('   # Click the test buttons'));
  
  console.log(chalk.white('\nTo check if events are being captured:'));
  console.log(chalk.gray('   • Development: Check browser console'));
  console.log(chalk.gray('   • Production: Check Sentry dashboard'));
}

function main() {
  console.log(chalk.blue.bold('\n🛡️  Sentry Setup Validator\n'));
  
  const filesOk = checkSentryFiles();
  const envOk = checkEnvironmentVariables();
  
  if (!filesOk || !envOk) {
    printSetupInstructions();
  }
  
  printNextSteps(filesOk, envOk);
  
  // Exit codes
  if (filesOk && envOk) {
    console.log(chalk.green('\n✨ Setup complete!\n'));
    process.exit(0);
  } else {
    console.log(chalk.yellow('\n⚠️  Setup incomplete. Follow the instructions above.\n'));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkSentryFiles, checkEnvironmentVariables };