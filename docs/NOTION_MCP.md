# Notion MCP Integration Documentation

## Overview

The Notion MCP (Model Context Protocol) integration connects Claude Code CLI to your ECOSYSTEM Notion workspace, enabling automatic documentation of technical decisions, architecture patterns, and security implementations.

## ✅ Setup Complete

### 1. Notion MCP Server Installed
- Official Notion MCP server: `@notionhq/notion-mcp-server`
- Configured in Claude with your integration token
- Connection verified and working

### 2. Configuration Files

#### `.env.notion` (DO NOT COMMIT)
```env
NOTION_API_KEY=ntn_385123... # Your internal integration token
NOTION_MAIN_HUB=2568f783-c9ba-8070-8023-f05f27d74279
NOTION_TECH_STACK_DB=2568f783-c9ba-80b8-92e7-f79334dda252
NOTION_INTEGRATIONS_DB=2568f783-c9ba-8023-a2a9-e4e1ff54ca28
NOTION_ARCHITECTURE_DB=2568f783-c9ba-8004-8af9-e0c123ebef49
NOTION_SECURITY_DB=2568f783-c9ba-8020-84ba-d36db3ef7dd5
```

### 3. Sync Script (`scripts/notion-sync.js`)

Helper script to sync project decisions with Notion databases.

## 📊 Database Structures

### Tech Stack Standards
- **Purpose**: Document technology choices and their rationale
- **Fields**: Stack Name, Components, Scalability Rating, AI Implementation Difficulty, Cost Structure, Use Cases, Pros/Cons, Documentation Links

### Integration Blueprints  
- **Purpose**: Track third-party service integrations
- **Fields**: Service Name, Use Case, Implementation Complexity, API Documentation, Cost Model, Alternatives, Features, Integration Notes

### Architecture Patterns
- **Purpose**: Document architectural decisions and patterns
- **Fields**: Pattern Name, Use Case, Scalability Limits, Implementation Guide, Real Examples, Complexity, Category

### Security Standards
- **Purpose**: Track security requirements and implementations
- **Fields**: Requirement, Implementation Method, Compliance Standard, Tools/Services, Verification Method, Priority, Status

## 🚀 Usage

### Command Line Usage

```bash
# Test connection
npm run notion-sync test

# Sync current tech stack
npm run notion-sync sync-stack

# Document Stripe integration
npm run notion-sync sync-stripe

# Document security implementations
npm run notion-sync sync-security

# Sync everything
npm run notion-sync sync-all

# Query databases
npm run notion-sync query-stack
npm run notion-sync query-security
```

### Using with Claude Code CLI

Claude Code CLI can now:

1. **Reference Standards**: Before making architecture decisions
   ```
   "Check our Tech Stack Standards in Notion before choosing a new library"
   ```

2. **Auto-Document Decisions**: When implementing new features
   ```
   "After implementing the booking system, update our Architecture Patterns database"
   ```

3. **Validate Compliance**: Before deploying code
   ```
   "Verify this implementation meets our Security Standards in Notion"
   ```

4. **Track Integrations**: When adding new services
   ```
   "Document the new email service in Integration Blueprints"
   ```

## 📝 What's Been Documented

### ✅ Security Implementations (3 entries added)
1. **Rate Limiting on Payment APIs** - Critical priority, Implemented
2. **Input Validation with Zod** - Critical priority, Implemented  
3. **Error Boundaries for Payment Flows** - High priority, Implemented

### ✅ Tech Stack (1 entry added)
- **ECOSYSTEM Marketplace Stack v1** - Complete stack documentation including Next.js 14, TypeScript, Tailwind, Drizzle, Supabase, Clerk, Stripe Connect

### 🔄 Pending Documentation
- Stripe Connect integration details (schema mismatch - needs manual entry)
- Additional architecture patterns from codebase
- Provider onboarding flow documentation

## 🔧 Programmatic Usage

### In Server Actions or API Routes

```javascript
const { 
  addTechStackEntry,
  addSecurityStandard,
  queryTechStack 
} = require('./scripts/notion-sync');

// Add a new tech decision
await addTechStackEntry({
  name: 'Redis for Caching',
  components: 'Redis, ioredis',
  scalability: 'High',
  aiDifficulty: 'Low',
  costStructure: '$100/month for managed Redis',
  useCases: 'Session storage, Cache',
  pros: 'Fast, Reliable',
  cons: 'Additional infrastructure',
  docLink: 'https://redis.io'
});

// Query existing standards
const techStack = await queryTechStack({
  property: 'Scalability Rating',
  select: { equals: 'High' }
});
```

## 🎯 Benefits

1. **Consistency**: All tech decisions follow documented standards
2. **Knowledge Base**: Automatic documentation as you build
3. **Compliance**: Track security implementation status
4. **Onboarding**: New developers can understand decisions
5. **AI Context**: Claude has access to your standards for better suggestions

## 🛠️ Maintenance

### Adding New Database Fields

If you add fields to your Notion databases, update the corresponding functions in `scripts/notion-sync.js`:
- Check field types (text, select, multi_select, status, etc.)
- Update the property mappings in add functions
- Test with sample data

### Troubleshooting

**Connection Issues**
```bash
npm run notion-sync test
```

**Field Type Errors**
- Notion API is strict about field types
- Check database schema in Notion
- Update script to match exact field types

**Permission Errors**
- Ensure your integration has access to all databases
- Share each database with your integration in Notion

## 🔒 Security Notes

1. **Never commit `.env.notion`** - It contains your API token
2. **Use read-only tokens** when possible for querying
3. **Rotate tokens** periodically for security
4. **Audit access** - Check who has access to your Notion workspace

## 📈 Next Steps

1. **Automate Documentation**: Add hooks to auto-document on deploy
2. **Build Dashboard**: Create a web view of your standards
3. **Add Validation**: Check code against standards before merge
4. **Expand Coverage**: Document more patterns as you build

---

Your Notion MCP integration is now fully operational! Claude Code CLI can reference your standards, document decisions, and ensure consistency across your entire ECOSYSTEM platform.