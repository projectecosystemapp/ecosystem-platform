# GitHub Authentication Setup for Force Push

## Quick Setup with Personal Access Token (PAT)

### Step 1: Create a GitHub Personal Access Token

1. Go to GitHub.com and log in
2. Click your profile picture → Settings
3. Scroll down to "Developer settings" (bottom of left sidebar)
4. Click "Personal access tokens" → "Tokens (classic)"
5. Click "Generate new token" → "Generate new token (classic)"
6. Give it a note like "ecosystem-platform-push"
7. Select scopes:
   - ✅ `repo` (full control of private repositories)
8. Click "Generate token"
9. **COPY THE TOKEN NOW** (you won't see it again!)

### Step 2: Use the token to push

Replace `YOUR_TOKEN` with your actual token:

```bash
# Option A: One-time push with token
git push https://YOUR_TOKEN@github.com/projectecosystemapp/ecosystem-platform.git main --force

# Option B: Update remote URL to include token (stores in git config)
git remote set-url origin https://YOUR_TOKEN@github.com/projectecosystemapp/ecosystem-platform.git
git push --force origin main
```

### Step 3: After successful push

If you used Option B, remove the token from the URL for security:

```bash
git remote set-url origin https://github.com/projectecosystemapp/ecosystem-platform.git
```

## Alternative: SSH Setup (More Secure Long-term)

If you prefer SSH for future use:

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key to agent
ssh-add ~/.ssh/id_ed25519

# Copy public key
cat ~/.ssh/id_ed25519.pub
```

Then add the public key to GitHub:
1. GitHub → Settings → SSH and GPG keys
2. Click "New SSH key"
3. Paste the public key
4. Save

Switch remote to SSH:
```bash
git remote set-url origin git@github.com:projectecosystemapp/ecosystem-platform.git
```

## IMPORTANT SECURITY NOTES

⚠️ **URGENT**: The exposed database password is still visible in your GitHub repository history until you force push!

⚠️ **Token Security**: 
- Never commit the token to any file
- Delete or revoke the token after use if only needed temporarily
- Use environment variables or credential managers for long-term storage

⚠️ **After Force Push**:
- Notify any team members that history has been rewritten
- They will need to re-clone or reset their local repos
