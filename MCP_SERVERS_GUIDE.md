# MCP Servers Configuration Guide

## 🚀 Configured MCP Servers

Your Ecosystem marketplace project now has 8 powerful MCP servers configured:

### 1. **Sequential Thinking** ✅
- **Purpose**: Structured reasoning and planning
- **Usage**: Complex problem solving with step-by-step thinking
- **Example**: "Use sequential thinking to plan the provider profile implementation"

### 2. **Filesystem** ✅
- **Purpose**: Direct file operations within the project
- **Usage**: Read, write, and manipulate project files
- **Example**: "List all React components in the app directory"

### 3. **Memory** ✅
- **Purpose**: Context retention across conversations
- **Usage**: Store and recall important project information
- **Example**: "Remember that our marketplace commission is 15%"

### 4. **PostgreSQL** 🔧
- **Purpose**: Direct database queries (read-only recommended)
- **Usage**: Query schema, data, and test SQL
- **Requires**: `PG_READONLY_URL` in `.env.local`
- **Example**: "Show me the structure of the providers table"

### 5. **Playwright** 🎭
- **Purpose**: Browser automation and UI testing
- **Usage**: Test user flows, take screenshots, verify UI
- **Example**: "Open the provider profile page and verify the booking button works"

### 6. **GitHub** 🐙
- **Purpose**: Repository management and issue tracking
- **Usage**: List PRs, issues, commits, and repository info
- **Requires**: `GITHUB_TOKEN` in `.env.local` (create at github.com/settings/tokens)
- **Example**: "List the last 3 open pull requests"

### 7. **Serena** 🤖
- **Purpose**: AI-powered code analysis and generation
- **Usage**: Deep codebase understanding, symbol search, refactoring
- **Example**: "Find all functions that handle booking logic"

### 8. **Context7** 📚
- **Purpose**: Documentation and knowledge management
- **Usage**: Query project docs, PRDs, and requirements
- **Example**: "Look up the acceptance criteria for provider profiles"

## 🔑 Environment Variables Required

Add these to your `.env.local`:

```env
# PostgreSQL Read-Only Connection
PG_READONLY_URL=postgresql://postgres.mhyqvbeiqwkgfyqdfnlu:[YOUR-NEW-PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:5432/postgres

# GitHub Personal Access Token
# Create at: https://github.com/settings/tokens
# Scopes needed: repo:read, issues:read, pull_requests:read
GITHUB_TOKEN=your_github_pat_here
```

## 🧪 Test Commands

After setup, test each server with these commands:

### PostgreSQL Test
```
Using the postgres MCP server, list all tables in the database and show the first 2 rows from the providers table.
```

### Playwright Test
```
Using the playwright MCP server, navigate to http://localhost:3000 and take a screenshot of the homepage.
```

### GitHub Test
```
Using the github MCP server, show me the last 3 commits in this repository.
```

### Serena Test
```
Using the serena MCP server, find all React components that use the useState hook.
```

### Context7 Test
```
Using the context7 MCP server, summarize the contents of the CLAUDE.md file.
```

## 🎯 Usage with Agents

You can now use these servers with Task agents for complex workflows:

```
Use the following MCP servers to implement provider profiles:
1. Use sequential thinking to plan the implementation
2. Use postgres to understand the database schema
3. Use filesystem to create the necessary components
4. Use serena to find similar patterns in the codebase
5. Use playwright to test the final implementation
```

## ⚠️ Important Notes

1. **PostgreSQL**: Currently using production connection. Consider creating a read-only user for safety.
2. **GitHub**: Requires PAT token. Without it, the server won't connect.
3. **Playwright**: May download Chromium on first run (~150MB).
4. **Context7 & Serena**: May take time to index on first use.

## 🔄 Updating Configuration

To add more servers:
```bash
claude mcp add --scope project [name] -- [command]
```

To remove a server:
```bash
claude mcp remove [name]
```

To list all servers:
```bash
claude mcp list
```

## 📝 Configuration File

All servers are configured in `.mcp.json` at the project root. This file is version-controlled and shared with your team.

## 🚦 Server Status

Run `/mcp` in Claude Code chat to see the current status and authenticate servers that need it (like Vercel).

## 🎉 Ready to Build!

With these MCP servers, you now have:
- Database access for schema understanding
- File manipulation for code generation
- Browser testing for UI verification
- Repository awareness for context
- AI-powered code analysis
- Documentation querying

You're fully equipped to build the Ecosystem marketplace with agent assistance!