#!/usr/bin/env node

/**
 * Notion Sync Script for ECOSYSTEM Project
 * 
 * This script provides helper functions to sync project decisions with Notion databases.
 * It enables bi-directional sync between code and documentation.
 */

const { Client } = require('@notionhq/client');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load Notion configuration
dotenv.config({ path: path.join(__dirname, '..', '.env.notion') });

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Database IDs from your ECOSYSTEM workspace
const DATABASES = {
  TECH_STACK: process.env.NOTION_TECH_STACK_DB,
  INTEGRATIONS: process.env.NOTION_INTEGRATIONS_DB,
  ARCHITECTURE: process.env.NOTION_ARCHITECTURE_DB,
  SECURITY: process.env.NOTION_SECURITY_DB,
  MAIN_HUB: process.env.NOTION_MAIN_HUB,
};

/**
 * Helper Functions for Each Database
 */

// Tech Stack Standards Database
async function addTechStackEntry(data) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: DATABASES.TECH_STACK },
      properties: {
        'Stack Name': {
          title: [{ text: { content: data.name } }]
        },
        'Components': {
          rich_text: [{ text: { content: data.components || '' } }]
        },
        'Scalability Rating': {
          select: { name: data.scalability || 'Medium' }
        },
        'AI Implementation Difficulty': {
          select: { name: data.aiDifficulty || 'Medium' }
        },
        'Cost Structure': {
          rich_text: [{ text: { content: data.costStructure || '' } }]
        },
        'Use Cases': {
          multi_select: data.useCases ? 
            data.useCases.split(',').map(u => ({ name: u.trim() })) : []
        },
        'Pros': {
          rich_text: [{ text: { content: data.pros || '' } }]
        },
        'Cons': {
          rich_text: [{ text: { content: data.cons || '' } }]
        },
        'Documentation Links': {
          url: data.docLink || null
        }
      }
    });
    console.log('✅ Added tech stack entry:', data.name);
    return response;
  } catch (error) {
    console.error('❌ Error adding tech stack entry:', error);
    throw error;
  }
}

// Integration Blueprints Database
async function addIntegrationBlueprint(data) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: DATABASES.INTEGRATIONS },
      properties: {
        'Service Name': {
          title: [{ text: { content: data.serviceName } }]
        },
        'Use Case': {
          rich_text: [{ text: { content: data.useCase || '' } }]
        },
        'Implementation Complexity': {
          select: { name: data.complexity || 'Medium' }
        },
        'API Documentation': {
          url: data.apiDoc || null
        },
        'Cost Model': {
          rich_text: [{ text: { content: data.costModel || '' } }]
        },
        'Alternatives': {
          rich_text: [{ text: { content: data.alternatives || '' } }]
        },
        'Features': {
          rich_text: [{ text: { content: data.features || '' } }]
        },
        'Integration Notes': {
          rich_text: [{ text: { content: data.notes || '' } }]
        }
      }
    });
    console.log('✅ Added integration blueprint:', data.serviceName);
    return response;
  } catch (error) {
    console.error('❌ Error adding integration blueprint:', error);
    throw error;
  }
}

// Architecture Patterns Database
async function addArchitecturePattern(data) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: DATABASES.ARCHITECTURE },
      properties: {
        'Pattern Name': {
          title: [{ text: { content: data.patternName } }]
        },
        'Use Case': {
          rich_text: [{ text: { content: data.useCase || '' } }]
        },
        'Scalability Limits': {
          rich_text: [{ text: { content: data.scalabilityLimits || '' } }]
        },
        'Implementation Guide': {
          rich_text: [{ text: { content: data.implementationGuide || '' } }]
        },
        'Real Examples': {
          rich_text: [{ text: { content: data.realExamples || '' } }]
        },
        'Complexity': {
          select: { name: data.complexity || 'Medium' }
        },
        'Category': {
          select: { name: data.category || 'General' }
        }
      }
    });
    console.log('✅ Added architecture pattern:', data.patternName);
    return response;
  } catch (error) {
    console.error('❌ Error adding architecture pattern:', error);
    throw error;
  }
}

// Security Standards Database
async function addSecurityStandard(data) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: DATABASES.SECURITY },
      properties: {
        'Requirement': {
          title: [{ text: { content: data.requirement } }]
        },
        'Implementation Method': {
          rich_text: [{ text: { content: data.implementationMethod || '' } }]
        },
        'Compliance Standard': {
          multi_select: data.complianceStandards ? 
            data.complianceStandards.map(s => ({ name: s })) : []
        },
        'Tools/Services': {
          multi_select: data.tools ? 
            data.tools.split(',').map(t => ({ name: t.trim() })) : []
        },
        'Verification Method': {
          rich_text: [{ text: { content: data.verificationMethod || '' } }]
        },
        'Priority': {
          select: { name: data.priority || 'High' }
        },
        'Status': {
          status: { name: data.status || 'Planned' }
        }
      }
    });
    console.log('✅ Added security standard:', data.requirement);
    return response;
  } catch (error) {
    console.error('❌ Error adding security standard:', error);
    throw error;
  }
}

/**
 * Query Functions
 */

async function queryTechStack(filter = {}) {
  try {
    const response = await notion.databases.query({
      database_id: DATABASES.TECH_STACK,
      filter: filter,
    });
    return response.results;
  } catch (error) {
    console.error('❌ Error querying tech stack:', error);
    throw error;
  }
}

async function queryIntegrations(filter = {}) {
  try {
    const response = await notion.databases.query({
      database_id: DATABASES.INTEGRATIONS,
      filter: filter,
    });
    return response.results;
  } catch (error) {
    console.error('❌ Error querying integrations:', error);
    throw error;
  }
}

async function querySecurityStandards(filter = {}) {
  try {
    const response = await notion.databases.query({
      database_id: DATABASES.SECURITY,
      filter: filter,
    });
    return response.results;
  } catch (error) {
    console.error('❌ Error querying security standards:', error);
    throw error;
  }
}

/**
 * Auto-documentation Functions
 */

async function documentCurrentStack() {
  // Read package.json to get current tech stack
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );

  const techStack = {
    name: 'ECOSYSTEM Marketplace Stack v1',
    components: [
      'Next.js 14 (App Router)',
      'TypeScript',
      'Tailwind CSS',
      'Drizzle ORM',
      'Supabase',
      'Clerk Auth',
      'Stripe Connect',
      'Framer Motion'
    ].join(', '),
    scalability: 'High',
    aiDifficulty: 'Low',
    costStructure: 'Usage-based (Supabase, Clerk, Stripe fees)',
    useCases: 'Two-sided marketplace, Service booking platform',
    pros: 'Modern stack, Type-safe, Scalable, Great DX',
    cons: 'Multiple service dependencies, Learning curve for junior devs',
    docLink: 'https://github.com/yourusername/ecosystem'
  };

  return await addTechStackEntry(techStack);
}

async function documentStripeIntegration() {
  const stripeIntegration = {
    serviceName: 'Stripe Connect',
    useCase: 'Marketplace payments with automatic provider payouts',
    complexity: 'High',
    apiDoc: 'https://stripe.com/docs/connect',
    costModel: '2.9% + $0.30 per transaction + 0.25% for Connect',
    alternatives: 'PayPal Commerce, Square, Paddle',
    features: 'Direct charges, Application fees, Automatic payouts, Onboarding',
    notes: 'Using Express accounts for simplified onboarding'
  };

  return await addIntegrationBlueprint(stripeIntegration);
}

async function documentSecurityImplementations() {
  const securityItems = [
    {
      requirement: 'Rate Limiting on Payment APIs',
      implementationMethod: 'Custom middleware with in-memory store',
      complianceStandards: ['PCI-DSS', 'OWASP'],
      tools: 'Custom rate-limit.ts utility',
      verificationMethod: 'Load testing with Artillery',
      priority: 'Critical',
      status: 'Implemented'
    },
    {
      requirement: 'Input Validation with Zod',
      implementationMethod: 'Zod schemas for all API inputs',
      complianceStandards: ['OWASP', 'SOC2'],
      tools: 'Zod validation library',
      verificationMethod: 'Unit tests for validation schemas',
      priority: 'Critical',
      status: 'Implemented'
    },
    {
      requirement: 'Error Boundaries for Payment Flows',
      implementationMethod: 'React Error Boundaries with fallback UI',
      complianceStandards: ['PCI-DSS'],
      tools: 'Custom error-boundary.tsx components',
      verificationMethod: 'Manual testing of error scenarios',
      priority: 'High',
      status: 'Implemented'
    }
  ];

  for (const item of securityItems) {
    await addSecurityStandard(item);
  }
}

/**
 * Command Line Interface
 */

async function main() {
  const command = process.argv[2];

  console.log('🔄 Notion Sync Script for ECOSYSTEM');
  console.log('====================================\n');

  switch (command) {
    case 'sync-stack':
      console.log('📚 Documenting current tech stack...');
      await documentCurrentStack();
      break;

    case 'sync-stripe':
      console.log('💳 Documenting Stripe integration...');
      await documentStripeIntegration();
      break;

    case 'sync-security':
      console.log('🔒 Documenting security implementations...');
      await documentSecurityImplementations();
      break;

    case 'sync-all':
      console.log('🎯 Syncing all documentation...');
      await documentCurrentStack();
      await documentStripeIntegration();
      await documentSecurityImplementations();
      break;

    case 'query-stack':
      console.log('🔍 Querying tech stack standards...');
      const stack = await queryTechStack();
      console.log(`Found ${stack.length} tech stack entries`);
      break;

    case 'query-security':
      console.log('🔍 Querying security standards...');
      const security = await querySecurityStandards();
      console.log(`Found ${security.length} security standards`);
      break;

    case 'test':
      console.log('🧪 Testing Notion connection...');
      try {
        const response = await notion.databases.retrieve({ 
          database_id: DATABASES.TECH_STACK 
        });
        console.log('✅ Successfully connected to Notion!');
        console.log('📊 Tech Stack Database:', response.title[0]?.plain_text || 'Connected');
      } catch (error) {
        console.error('❌ Connection failed:', error.message);
      }
      break;

    default:
      console.log('Usage: npm run notion-sync [command]');
      console.log('\nCommands:');
      console.log('  test           - Test Notion connection');
      console.log('  sync-stack     - Document current tech stack');
      console.log('  sync-stripe    - Document Stripe integration');
      console.log('  sync-security  - Document security implementations');
      console.log('  sync-all       - Sync all documentation');
      console.log('  query-stack    - Query tech stack standards');
      console.log('  query-security - Query security standards');
  }
}

// Export functions for use in other scripts
module.exports = {
  addTechStackEntry,
  addIntegrationBlueprint,
  addArchitecturePattern,
  addSecurityStandard,
  queryTechStack,
  queryIntegrations,
  querySecurityStandards,
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}