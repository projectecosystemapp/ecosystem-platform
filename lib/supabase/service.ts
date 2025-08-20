import { createClient } from '@supabase/supabase-js'

// This client bypasses Row Level Security and should only be used
// in secure server-side environments like API routes that need admin access
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}