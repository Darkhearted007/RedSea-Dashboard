import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Graceful fallback — app renders fine without Supabase
const hasCredentials = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!hasCredentials) {
  console.warn("Supabase credentials not configured — persistence disabled")
}

// Export a client that won't crash when env vars are missing
export const supabase = hasCredentials
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : createClient("https://placeholder.supabase.co", "placeholder-key")
