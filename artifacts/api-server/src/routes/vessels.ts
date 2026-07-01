import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

router.get("/vessels", async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.json([]);
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  const { data, error } = await supabase
    .from("vessel_threat_profiles")
    .select("*")
    .order("score", { ascending: false })
    .limit(limit);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data || []);
});

export default router;
