# Supabase Environment Variables Setup

## Where to Find Your Supabase Credentials

### 1. Go to Supabase Dashboard
Visit [app.supabase.com](https://app.supabase.com) and sign in to your account.

### 2. Select Your Project
Choose the project you want to use for production (or create a new one).

### 3. Get Your Environment Variables

Navigate to **Settings** (gear icon) → **API** in your Supabase project dashboard.

You'll find these values:

#### DATABASE_URL
- Go to **Settings** → **Database**
- Look for "Connection string" section
- Click on **URI** tab
- Copy the connection string that looks like:
  ```
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
  ```
- **IMPORTANT**: You may need to append `?pgbouncer=true&connection_limit=1` to the end for serverless environments like Vercel

#### NEXT_PUBLIC_SUPABASE_URL
- Go to **Settings** → **API**
- Find **Project URL**
- It looks like: `https://[PROJECT-REF].supabase.co`

#### NEXT_PUBLIC_SUPABASE_ANON_KEY
- Go to **Settings** → **API**
- Find **Project API keys** section
- Copy the **anon public** key
- This is a long JWT token starting with `eyJ...`

#### SUPABASE_SERVICE_ROLE_KEY
- Go to **Settings** → **API**
- Find **Project API keys** section
- Copy the **service_role** key (click reveal first)
- ⚠️ **KEEP THIS SECRET** - Never expose this in client-side code
- This is also a long JWT token starting with `eyJ...`

## Example Values (DO NOT USE THESE - GET YOUR OWN)

```env
# Database
DATABASE_URL=postgresql://postgres.abcdefghijk:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...rest_of_token
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...rest_of_token
```

## Setting Up in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** tab
3. Navigate to **Environment Variables**
4. Add each variable:
   - Name: `DATABASE_URL`
   - Value: [paste your connection string]
   - Environment: ✓ Production, ✓ Preview, ✓ Development
5. Repeat for all Supabase variables

## Creating a New Supabase Project (If Needed)

If you don't have a Supabase project yet:

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Fill in:
   - Project name: `ecosystem-platform` (or your choice)
   - Database Password: Generate a strong password (SAVE THIS!)
   - Region: Choose closest to your users
   - Plan: Free tier is fine to start
4. Click **Create Project**
5. Wait for project to be ready (~2 minutes)
6. Follow the steps above to get your credentials

## Important Notes

- **Database Password**: If you forgot your database password, you can reset it in Settings → Database
- **Connection Pooling**: For Vercel, use the "Connection pooling" connection string (with port 6543) instead of direct connection
- **SSL Mode**: Supabase connections require SSL in production
- **Rate Limits**: Free tier has rate limits - monitor your usage in the Supabase dashboard

## Test Your Connection

After setting up environment variables in Vercel:

1. Trigger a new deployment
2. Check the function logs in Vercel
3. Test a page that requires database access (like `/dashboard`)
4. If you see errors, check:
   - Connection string format
   - Password is correct
   - Database is not paused (free tier pauses after 1 week of inactivity)