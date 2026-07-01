import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

router.post("/persist/violation", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.json({ ok: true, skipped: "no supabase credentials" });
    return;
  }
  const { error } = await supabaseAdmin.from("violation_log").insert(req.body);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

router.post("/persist/threat-profile", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.json({ ok: true, skipped: "no supabase credentials" });
    return;
  }
  const { error } = await supabaseAdmin.from("vessel_threat_profiles").upsert(req.body, { onConflict: "mmsi" });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

router.post("/persist/document", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.json({ ok: true, skipped: "no supabase credentials" });
    return;
  }
  const { error } = await supabaseAdmin.from("document_registry").insert(req.body);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

router.post("/persist/position", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.json({ ok: true, skipped: "no supabase credentials" });
    return;
  }
  const { error } = await supabaseAdmin.from("ais_positions").insert(req.body);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

router.post("/persist/sanctions", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.json({ ok: true, skipped: "no supabase credentials" });
    return;
  }
  const { error } = await supabaseAdmin.from("sanctions_hits").insert(req.body);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

router.get("/health/ai", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.json({ ok: false, timestamp: new Date().toISOString(), services: { supabase: false } });
    return;
  }
  const { error } = await supabaseAdmin
    .from("port_intelligence")
    .select("port_code", { count: "exact", head: true });
  res.json({
    ok: !error,
    timestamp: new Date().toISOString(),
    services: { supabase: !error },
  });
});

export default router;
