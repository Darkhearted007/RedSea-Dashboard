import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { error } = await supabaseAdmin.from("vessel_threat_profiles").upsert(body, { onConflict: "mmsi" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
