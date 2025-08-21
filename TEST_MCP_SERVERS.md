# MCP Server Test Commands

Run these commands in Claude Code chat to test each MCP server:

## ✅ Ready to Test

### 1. Sequential Thinking
```
Using the seq-thinking MCP server, create a 3-step plan for implementing the provider profile page.
```

### 2. Filesystem
```
Using the filesystem MCP server, list all files in the app/dashboard directory.
```

### 3. Memory
```
Using the memory MCP server, remember these facts: 
- Marketplace name: Ecosystem
- Commission rate: 15%
- Database: Supabase PostgreSQL
- Region: Canada (ca-central-1)
```

## 🔧 Requires Environment Variables

### 4. PostgreSQL (needs PG_READONLY_URL)
```
Using the postgres MCP server, run this query: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5;
```

### 5. GitHub (needs GITHUB_TOKEN) ✅ Token Added!
```
Using the github MCP server, show me the details of this repository including name, description, and last commit.
```

## 🎭 Additional Servers

### 6. Playwright
```
Using the playwright MCP server, navigate to http://localhost:3000 and get the page title.
```

### 7. Serena
```
Using the serena MCP server, analyze the codebase and find all React components.
```

### 8. Context7
```
Using the context7 MCP server, read and summarize the CLAUDE.md file.
```

## 📝 Notes

- If servers don't appear, try `/mcp` command first
- You may need to restart Claude Code for new servers to appear
- The PostgreSQL and GitHub servers now have credentials configured
- Playwright may download Chromium on first run

## 🚀 All-in-One Test

Once servers are working, try this comprehensive command:

```
Use multiple MCP servers to analyze the project:
1. Use postgres to list all database tables
2. Use filesystem to show the project structure
3. Use github to show recent commits
4. Use sequential thinking to plan the next development phase
```