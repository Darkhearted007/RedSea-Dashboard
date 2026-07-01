import { createClient } from "@supabase/supabase-js"

// Server-side only — uses service_role key for admin operations
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hasCredentials = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)

export const supabaseAdmin = hasCredentials
  ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : createClient("https://placeholder.supabase.co", "placeholder-key", {
      auth: { autoRefreshToken: false, persistSession: false },
    })
