import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!isSupabaseConfigured) {
      console.warn("⚠️ Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY")
      _supabase = createClient("https://placeholder.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_5NjP1G4vdTOXBKRuMxWo")
    } else {
      _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    }
  }
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})
