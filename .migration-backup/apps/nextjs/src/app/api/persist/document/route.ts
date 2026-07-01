import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { error } = await supabaseAdmin.from("document_registry").upsert(body, { onConflict: "document_id" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
