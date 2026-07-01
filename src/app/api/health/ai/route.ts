import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  // Check Supabase service role is working
  const { error } = await supabaseAdmin
    .from("port_intelligence")
    .select("port_code", { count: "exact", head: true })

  return NextResponse.json({
    ok: !error,
    timestamp: new Date().toISOString(),
    services: {
      supabase: !error,
    }
  })
}
