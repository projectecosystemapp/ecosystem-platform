# MCP Server Environment Variables Setup

## ✅ ALL Environment Variables Configured

### Complete Environment Setup
All environment variables from your project have been permanently configured and are available system-wide.

### 📋 Environment Variables Loaded

#### **MCP Server Variables**
- ✅ **DATABASE_URL** - PostgreSQL/Supabase connection
- ✅ **NOTION_API_KEY** - Notion integration token

#### **Notion Database IDs**
- ✅ **NOTION_MAIN_HUB** - Main hub database
- ✅ **NOTION_TECH_STACK_DB** - Tech stack standards
- ✅ **NOTION_INTEGRATIONS_DB** - Integration blueprints
- ✅ **NOTION_ARCHITECTURE_DB** - Architecture patterns
- ✅ **NOTION_SECURITY_DB** - Security standards
- ✅ **NOTION_TECH_STACK_COLLECTION** - Tech stack collection
- ✅ **NOTION_INTEGRATIONS_COLLECTION** - Integrations collection
- ✅ **NOTION_ARCHITECTURE_COLLECTION** - Architecture collection
- ✅ **NOTION_SECURITY_COLLECTION** - Security collection

#### **Supabase Configuration**
- ✅ **NEXT_PUBLIC_SUPABASE_URL** - Supabase project URL
- ✅ **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Public anonymous key
- ✅ **SUPABASE_SERVICE_ROLE_KEY** - Service role key

#### **Clerk Authentication**
- ✅ **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY** - Public key
- ✅ **CLERK_SECRET_KEY** - Secret key
- ✅ **NEXT_PUBLIC_CLERK_SIGN_IN_URL** - Sign in URL
- ✅ **NEXT_PUBLIC_CLERK_SIGN_UP_URL** - Sign up URL
- ✅ **NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL** - Post-signup redirect
- ✅ **NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL** - Post-signin redirect
- ✅ **CLERK_COOKIE_DOMAIN** - Cookie domain
- ✅ **CLERK_SESSION_TOKEN_LEEWAY** - Token leeway
- ✅ **CLERK_ROTATE_SESSION_INTERVAL** - Session rotation interval

#### **Stripe Configuration**
- ✅ **STRIPE_SECRET_KEY** - Stripe secret key
- ✅ **STRIPE_WEBHOOK_SECRET** - Webhook secret
- ✅ **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** - Public key
- ✅ **STRIPE_CONNECT_CLIENT_ID** - Connect client ID

#### **Platform Configuration**
- ✅ **ACTIVE_PAYMENT_PROVIDER** - Payment provider (stripe)
- ✅ **NEXT_PUBLIC_PLATFORM_FEE_PERCENT** - Platform fee percentage
- ✅ **NEXT_PUBLIC_APP_URL** - Application URL

#### **Additional Services**
- ✅ **RESEND_API_KEY** - Email service key
- ✅ **GITHUB_TOKEN** - GitHub access token
- ✅ **PG_READONLY_URL** - Read-only database URL

## 🛠️ Setup Complete

The following has been configured:

1. **Comprehensive setup script**: `scripts/setup-all-env.sh`
   - Loads ALL environment variables from all `.env` files
   - Can be run anytime with: `source scripts/setup-all-env.sh`

2. **Permanent environment file**: `~/.mcp_env_vars.sh`
   - Contains all exported environment variables
   - Automatically sourced on shell startup

3. **Shell profiles updated**: 
   - `~/.zshrc` - Updated with automatic sourcing
   - Variables available in all new terminal sessions

4. **Current session updated**
   - All variables immediately available in current terminal

## 📋 Quick Reference

### To verify environment variables are set:
```bash
echo $DATABASE_URL
echo $NOTION_API_KEY
```

### To reload environment variables:
```bash
source ~/.zshrc
# OR
source scripts/setup-mcp-env.sh
```

### MCP Configuration (.mcp.json)
Your MCP servers are configured to use these environment variables:
- **Notion Server**: Uses `${NOTION_API_KEY}`
- **PostgreSQL Server**: Uses `${DATABASE_URL}` (mapped to `POSTGRES_CONNECTION_STRING`)

## 🔒 Security Notes

1. **Never commit these files to version control**:
   - `.env.notion` (contains API keys)
   - `.env.production` (contains database credentials)
   - Both are already in `.gitignore`

2. **Rotate credentials periodically**:
   - Update Notion integration token if compromised
   - Change database password if needed

3. **Use environment-specific credentials**:
   - Keep production credentials separate from development
   - Use different API keys for different environments

## 🚀 Using MCP Servers

With these environment variables set, your MCP servers should now work properly:

1. **Notion MCP**: Can read/write to your Notion workspace
2. **PostgreSQL MCP**: Can query your Supabase database

The Claude Code CLI will now be able to:
- Access your Notion databases and pages
- Query your PostgreSQL/Supabase database
- Use these integrations in your development workflow

## 📝 Troubleshooting

If MCP servers still show errors:

1. **Restart Claude Code CLI**:
   ```bash
   # Close and reopen Claude Code
   # OR restart the terminal
   ```

2. **Verify variables are exported**:
   ```bash
   env | grep DATABASE_URL
   env | grep NOTION_API_KEY
   ```

3. **Check MCP server logs**:
   - Look for connection errors in Claude Code output
   - Verify the server URLs and credentials are correct

## 📚 Additional Resources

- [MCP Documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Notion MCP Setup](docs/NOTION_MCP.md)
- [Supabase Setup](SUPABASE_SETUP.md)
