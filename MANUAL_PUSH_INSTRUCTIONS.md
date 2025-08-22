# Manual Push Instructions

Since the automated push is encountering permission issues, you can complete the security fix manually.

## Option 1: Direct Terminal Push (Simplest)

The credentials are already set in your git config. Just run this in your terminal:

```bash
git push --force origin main
```

If that still fails, try:

## Option 2: Check Token Permissions

Your token might be missing the full "repo" scope. Go back to GitHub and verify your token has:
- ✅ **repo** (Full control of private repositories) - ALL sub-permissions checked

## Option 3: Check Branch Protection Rules

1. Go to: https://github.com/projectecosystemapp/ecosystem-platform/settings/branches
2. Check if "main" branch has protection rules
3. Temporarily disable them if needed
4. Push your changes
5. Re-enable protection

## Option 4: Use GitHub Desktop or VS Code

If you have GitHub Desktop or VS Code's Git integration:
1. They often handle authentication better
2. Try pushing through their UI

## Option 5: Create New Token with Full Permissions

1. Go to: https://github.com/settings/tokens/new
2. Name: "ecosystem-force-push"
3. Expiration: 7 days (or custom)
4. Select scopes:
   - ✅ **repo** (check ALL sub-boxes)
   - ✅ **workflow** (if the repo has GitHub Actions)
5. Generate token
6. Use command:
   ```bash
   git push https://YOUR_NEW_TOKEN@github.com/projectecosystemapp/ecosystem-platform.git main --force
   ```

## Option 6: SSH Key Setup (Most Reliable)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "customer-support@projectecosystemapp.com" -f ~/.ssh/github_ecosystem

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github_ecosystem

# Copy public key
cat ~/.ssh/github_ecosystem.pub
```

Then:
1. Add key to GitHub: Settings → SSH Keys → New SSH Key
2. Update remote:
   ```bash
   git remote set-url origin git@github.com:projectecosystemapp/ecosystem-platform.git
   git push --force origin main
   ```

## CRITICAL REMINDER

⚠️ **The exposed database password is STILL visible in your GitHub repository!**

Every minute it remains there increases security risk. Please complete one of these options immediately.

## After Successful Push

```bash
# Remove token from git config for security
git remote set-url origin https://github.com/projectecosystemapp/ecosystem-platform.git

# Verify the bad commits are gone
git log --oneline | head -20
