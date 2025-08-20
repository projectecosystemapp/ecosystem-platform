# How to Get Your Exact Supabase Connection String

## Step 1: Go to Your Supabase Project

1. Open: https://supabase.com/dashboard/project/mhyqvbeiqwkgfyqdfnlu
2. Click on **"Connect"** button (top right, near the project name)

## Step 2: In the Connection Dialog

You'll see several options. Look for:

1. **"Connection string"** section
2. You'll see tabs like:
   - Direct connection
   - Session pooler
   - Transaction pooler

## Step 3: Choose the Right Connection Type

For pushing schema with Drizzle Kit:
- Use **"Direct connection"** or **"Session pooler"**

For Vercel deployment:
- Use **"Transaction pooler"** 

## Step 4: Copy the EXACT String

The connection string will be shown. It should look like one of these:

### Direct Connection:
```
postgres://postgres:[YOUR-PASSWORD]@db.mhyqvbeiqwkgfyqdfnlu.supabase.co:5432/postgres
```

### Pooler Connection:
```
postgres://postgres.mhyqvbeiqwkgfyqdfnlu:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**IMPORTANT**: Replace `[YOUR-PASSWORD]` with `ECOSYSTEMPROJECTAPPPASSWORD2025`

## Step 5: Run the Push Command

Once you have the exact connection string:

```bash
DATABASE_URL="[PASTE_YOUR_CONNECTION_STRING_HERE]" npx drizzle-kit push
```

## Alternative: Use Supabase CLI

If the connection string doesn't work, we can use Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref mhyqvbeiqwkgfyqdfnlu

# Push migrations
supabase db push
```

## What We're Looking For

The connection dialog should show you:
- The exact hostname (might not be db.mhyqvbeiqwkgfyqdfnlu.supabase.co)
- The correct port (5432 or 6543)
- The correct username format (postgres or postgres.mhyqvbeiqwkgfyqdfnlu)
- Any required SSL parameters

## If You Can't Find It

1. Go to **Settings** → **Database**
2. Look for **"Connection info"** section
3. You'll see:
   - Host
   - Database name
   - Port
   - User

Construct the URL like:
```
postgresql://[User]:[Password]@[Host]:[Port]/[Database]
```

## Test the Connection

You can test if the connection works using any PostgreSQL client or even curl:

```bash
# This should return some response if the host exists
curl -I https://mhyqvbeiqwkgfyqdfnlu.supabase.co
```

Let me know what exact connection string Supabase shows you!