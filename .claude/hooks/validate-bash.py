#!/usr/bin/env python3
"""
validate-bash.py - Command validation for marketplace development
Blocks dangerous commands and enforces best practices
"""

import json
import sys
import re

def validate_command(command: str) -> list[tuple[str, str]]:
    """
    Validate a bash command and return any issues found.
    Returns a list of (issue, suggestion) tuples.
    """
    issues = []
    
    # Dangerous file operations
    dangerous_patterns = [
        (r'\brm\s+-rf\s+/', "Destructive recursive deletion blocked. Use targeted deletion instead."),
        (r'\brm\s+-rf\s+\.', "Destructive recursive deletion of current directory blocked."),
        (r'\brm\s+-fr', "Destructive recursive deletion blocked. Use targeted deletion instead."),
        (r'\b(rm|del|rmdir)\s+.*\*', "Wildcard deletion blocked. Be more specific about what to delete."),
    ]
    
    # Database dangerous operations
    db_patterns = [
        (r'DROP\s+(TABLE|DATABASE|SCHEMA)', "Direct database destruction blocked. Use migrations instead."),
        (r'TRUNCATE\s+TABLE', "Direct table truncation blocked. Use proper data management."),
        (r'DELETE\s+FROM\s+\w+\s*;', "Unfiltered DELETE blocked. Add a WHERE clause."),
        (r'UPDATE\s+\w+\s+SET.*\s*;', "Unfiltered UPDATE blocked. Add a WHERE clause."),
    ]
    
    # Production database protection
    prod_patterns = [
        (r'postgres://.*@.*\.supabase\.co', "Direct production database access blocked. Use migrations."),
        (r'--host.*\.supabase\.co', "Direct production database access blocked. Use migrations."),
        (r'psql.*production', "Direct production database access blocked. Use migrations."),
    ]
    
    # Stripe API protection
    stripe_patterns = [
        (r'curl.*stripe\.com/v1', "Direct Stripe API calls should use the SDK instead."),
        (r'sk_live_', "Live Stripe key detected! Never use in commands."),
        (r'wget.*stripe\.com', "Direct Stripe downloads blocked. Use official SDK."),
    ]
    
    # System-level dangerous commands
    system_patterns = [
        (r'\bsudo\b', "Elevated permissions not needed for development."),
        (r'\bnpm\s+install\s+-g(?!\s+@claude)', "Global npm installs not recommended. Use npx or local install."),
        (r'\byarn\s+global\s+add', "Global yarn installs not recommended. Use local install."),
        (r'\bchmod\s+777', "Overly permissive file permissions. Use 755 or 644 instead."),
        (r'\bkill\s+-9', "Force killing processes can cause data corruption. Try without -9 first."),
        (r'\b>\s*/dev/null\s+2>&1', "Hiding all output makes debugging difficult. Consider keeping error output."),
    ]
    
    # Git dangerous operations
    git_patterns = [
        (r'git\s+push\s+.*--force(?!-with-lease)', "Force push without lease is dangerous. Use --force-with-lease."),
        (r'git\s+reset\s+--hard\s+HEAD', "Hard reset will lose uncommitted changes. Consider --soft or stash."),
        (r'git\s+clean\s+-[fd]', "Git clean will delete untracked files. Make sure you want this."),
    ]
    
    # Check for inefficient patterns that should use better tools
    inefficient_patterns = [
        (r'\bgrep\b(?!.*\|)(?!.*--help)', "Use 'rg' (ripgrep) instead of grep for better performance."),
        (r'\bfind\s+.*-name', "Use 'rg --files -g pattern' instead of find for better performance."),
        (r'\bcat\s+.*\|\s*grep', "Use 'rg pattern file' instead of cat | grep."),
        (r'for\s+.*in.*\$\(ls', "Don't parse ls output. Use glob patterns or find instead."),
    ]
    
    # Check command against all patterns
    all_patterns = [
        ("Dangerous Operations", dangerous_patterns),
        ("Database Safety", db_patterns),
        ("Production Protection", prod_patterns),
        ("Stripe Security", stripe_patterns),
        ("System Safety", system_patterns),
        ("Git Safety", git_patterns),
        ("Performance", inefficient_patterns),
    ]
    
    for category, patterns in all_patterns:
        for pattern, message in patterns:
            if re.search(pattern, command, re.IGNORECASE):
                issues.append((f"[{category}] {message}", pattern))
    
    # Additional context-aware checks
    
    # Check for hardcoded secrets
    secret_patterns = [
        r'STRIPE_SECRET_KEY=sk_',
        r'DATABASE_URL=postgres://',
        r'CLERK_SECRET_KEY=',
        r'SUPABASE_SERVICE_KEY=',
    ]
    
    for pattern in secret_patterns:
        if re.search(pattern, command):
            issues.append((
                "Never put secrets directly in commands. Use environment variables.",
                pattern
            ))
    
    # Check for development-only commands in wrong context
    if 'production' in command.lower() and any(x in command for x in ['npm run dev', 'next dev', 'localhost']):
        issues.append((
            "Development commands detected with 'production' keyword. Double-check your intent.",
            "context"
        ))
    
    return issues

def main():
    """Main entry point for the hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Extract relevant fields
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")
    
    # Only validate Bash commands
    if tool_name != "Bash":
        sys.exit(0)
    
    # Skip validation for certain safe commands
    safe_prefixes = [
        "echo ",
        "pwd",
        "ls ",
        "git status",
        "git diff",
        "git log",
        "npm run type-check",
        "npm run lint",
        "npm test",
        "cat package.json",
        "which ",
        "node --version",
        "npm --version",
    ]
    
    if any(command.strip().startswith(prefix) for prefix in safe_prefixes):
        sys.exit(0)
    
    # Validate the command
    issues = validate_command(command)
    
    if issues:
        print("🚫 Command validation failed:", file=sys.stderr)
        print("", file=sys.stderr)
        
        # Group issues by severity
        critical_issues = [i for i in issues if any(
            keyword in i[0] for keyword in ['production', 'Live', 'DROP', 'TRUNCATE', 'rm -rf']
        )]
        
        warning_issues = [i for i in issues if i not in critical_issues]
        
        # Show critical issues first
        if critical_issues:
            print("❌ CRITICAL ISSUES:", file=sys.stderr)
            for issue, _ in critical_issues:
                print(f"   • {issue}", file=sys.stderr)
            print("", file=sys.stderr)
        
        # Show warnings
        if warning_issues:
            print("⚠️  WARNINGS:", file=sys.stderr)
            for issue, _ in warning_issues:
                print(f"   • {issue}", file=sys.stderr)
            print("", file=sys.stderr)
        
        # Provide the command for reference
        print(f"Command: {command[:100]}{'...' if len(command) > 100 else ''}", file=sys.stderr)
        print("", file=sys.stderr)
        
        # Suggest alternatives if available
        if any('rg' in issue[0] for issue in issues):
            print("💡 Tip: ripgrep (rg) is faster and more feature-rich than grep", file=sys.stderr)
        
        if any('migration' in issue[0].lower() for issue in issues):
            print("💡 Tip: Use 'npm run db:migrate' for database changes", file=sys.stderr)
        
        # Exit code 2 blocks the command and shows stderr to Claude
        if critical_issues:
            sys.exit(2)
        else:
            # For warnings, we'll allow but show the message
            print("\n⚠️  Proceeding with caution...", file=sys.stderr)
            sys.exit(0)
    
    # Command is safe
    sys.exit(0)

if __name__ == "__main__":
    main()