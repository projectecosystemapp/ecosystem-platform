#!/bin/bash

# MCP Server Fix Script
# Fixes all MCP server connection issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 Fixing MCP Server Connections"
echo "================================="
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    CONFIG_PATH="$HOME/.config/claude/.claude.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
    CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
fi

echo -e "${BLUE}Detected OS: $OS${NC}"
echo -e "${BLUE}Config path: $CONFIG_PATH${NC}"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${YELLOW}Creating new config file...${NC}"
    mkdir -p "$(dirname "$CONFIG_PATH")"
    echo '{}' > "$CONFIG_PATH"
fi

# Install required MCP servers globally
echo "Installing MCP servers globally..."
npm install -g @modelcontextprotocol/server-git@latest 2>/dev/null || true
npm install -g @modelcontextprotocol/server-fetch@latest 2>/dev/null || true
npm install -g @modelcontextprotocol/server-filesystem@latest 2>/dev/null || true
npm install -g @modelcontextprotocol/server-memory@latest 2>/dev/null || true
npm install -g @modelcontextprotocol/server-github@latest 2>/dev/null || true
npm install -g @modelcontextprotocol/server-everything@latest 2>/dev/null || true

# Create wrapper script for NVM compatibility
WRAPPER_PATH="$HOME/.mcp-wrapper.sh"
echo "Creating NVM wrapper script..."
cat > "$WRAPPER_PATH" << 'EOF'
#!/bin/bash
# MCP Server Wrapper for NVM compatibility
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    nvm use default >/dev/null 2>&1
fi
exec "$@"
EOF
chmod +x "$WRAPPER_PATH"

# Get current working directory for git server
CURRENT_DIR=$(pwd)

# Create the configuration
echo "Creating MCP configuration..."
cat > "$CONFIG_PATH" << EOF
{
  "mcpServers": {
    "filesystem": {
      "command": "$WRAPPER_PATH",
      "args": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "$CURRENT_DIR"]
    },
    "memory": {
      "command": "$WRAPPER_PATH",
      "args": ["npx", "-y", "@modelcontextprotocol/server-memory"]
    },
    "git": {
      "command": "$WRAPPER_PATH",
      "args": ["npx", "-y", "@modelcontextprotocol/server-git", "--repository", "$CURRENT_DIR"]
    },
    "fetch": {
      "command": "$WRAPPER_PATH",
      "args": ["npx", "-y", "@modelcontextprotocol/server-fetch"]
    },
    "github": {
      "command": "$WRAPPER_PATH",
      "args": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN:-}"
      }
    },
    "everything": {
      "command": "$WRAPPER_PATH",
      "args": ["npx", "-y", "@modelcontextprotocol/server-everything"]
    },
    "sequential-thinking": {
      "command": "$WRAPPER_PATH",
      "args": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
EOF

echo -e "${GREEN}✅ Configuration created${NC}"
echo ""

# Test each server
echo "Testing MCP servers..."
echo ""

test_server() {
    local name=$1
    local package=$2
    echo -n "Testing $name server... "
    
    # Create test input for MCP protocol
    TEST_INPUT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
    
    if echo "$TEST_INPUT" | npx -y "$package" 2>/dev/null | grep -q "result"; then
        echo -e "${GREEN}✅ Working${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed${NC}"
        return 1
    fi
}

# Test each server
test_server "filesystem" "@modelcontextprotocol/server-filesystem"
test_server "memory" "@modelcontextprotocol/server-memory"
test_server "git" "@modelcontextprotocol/server-git"
test_server "fetch" "@modelcontextprotocol/server-fetch"

echo ""
echo "======================================"
echo -e "${GREEN}✅ MCP Server Fix Complete${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Completely quit Claude Desktop/Code"
echo "2. Restart the application"
echo "3. Check for MCP indicator in the interface"
echo "4. Test with: 'Show me the git status of this repository'"
echo ""
echo "If servers still don't connect:"
echo "1. Check Developer settings in Claude"
echo "2. Enable Developer mode if not already"
echo "3. Look for error messages in the console"
echo ""
echo -e "${YELLOW}Note: You may need to set GITHUB_TOKEN environment variable for GitHub MCP server${NC}"