import { Router } from "express";
import { db, vesselThreatProfiles } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

/** Map Drizzle camelCase row → snake_case shape the frontend expects */
function toSnake(r: typeof vesselThreatProfiles.$inferSelect) {
  return {
    id:           r.id,
    mmsi:         r.mmsi,
    vessel_name:  r.vesselName,
    threat_level: r.threatLevel,
    score:        r.score,
    flags:        r.flags,
    last_lat:     r.lastLat,
    last_lon:     r.lastLon,
    last_speed:   r.lastSpeed,
    last_heading: r.lastHeading,
    updated_at:   r.updatedAt,
    created_at:   r.createdAt,
  };
}

// ── GET /api/vessels ──────────────────────────────────────────────────────────
router.get("/vessels", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const rows = await db
      .select()
      .from(vesselThreatProfiles)
      .orderBy(desc(vesselThreatProfiles.score))
      .limit(limit);
    res.json(rows.map(toSnake));
  } catch (err) {
    console.error("/api/vessels error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
