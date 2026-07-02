import { Router } from "express";
import {
  db,
  violationLog,
  vesselThreatProfiles,
  documentRegistry,
  aisPositions,
  sanctionsHits,
  portIntelligence,
} from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ── POST /api/persist/violation ───────────────────────────────────────────────
router.post("/persist/violation", async (req, res) => {
  try {
    const { mmsi, flag_code, severity, description, threat_score, lat, lon } = req.body;
    await db.insert(violationLog).values({
      mmsi,
      flagCode:    flag_code,
      severity,
      description,
      threatScore: String(threat_score ?? 0),
      lat: lat != null ? String(lat) : null,
      lon: lon != null ? String(lon) : null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("persist/violation error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/persist/threat-profile ─────────────────────────────────────────
router.post("/persist/threat-profile", async (req, res) => {
  try {
    const {
      mmsi, threat_level, score, flags,
      last_lat, last_lon, last_speed, last_heading, vessel_name,
    } = req.body;

    await db
      .insert(vesselThreatProfiles)
      .values({
        mmsi,
        threatLevel: threat_level ?? "CLEAN",
        score:       String(score ?? 0),
        flags:       flags ?? [],
        lastLat:     last_lat     != null ? String(last_lat)     : null,
        lastLon:     last_lon     != null ? String(last_lon)     : null,
        lastSpeed:   last_speed   != null ? String(last_speed)   : null,
        lastHeading: last_heading != null ? String(last_heading) : null,
        vesselName:  vessel_name ?? null,
        updatedAt:   new Date(),
      })
      .onConflictDoUpdate({
        target: vesselThreatProfiles.mmsi,
        set: {
          threatLevel: sql`excluded.threat_level`,
          score:       sql`excluded.score`,
          flags:       sql`excluded.flags`,
          lastLat:     sql`excluded.last_lat`,
          lastLon:     sql`excluded.last_lon`,
          lastSpeed:   sql`excluded.last_speed`,
          lastHeading: sql`excluded.last_heading`,
          vesselName:  sql`excluded.vessel_name`,
          updatedAt:   sql`now()`,
        },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("persist/threat-profile error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/persist/document ────────────────────────────────────────────────
router.post("/persist/document", async (req, res) => {
  try {
    const {
      document_id, file_name, file_hash, previous_hash, chain_hash,
      document_type, is_tampered, tamper_confidence, risk_score,
      flags, metadata, analysed_at,
    } = req.body;

    await db.insert(documentRegistry).values({
      documentId:       document_id,
      fileName:         file_name,
      fileHash:         file_hash,
      previousHash:     previous_hash ?? null,
      chainHash:        chain_hash ?? null,
      documentType:     document_type ?? null,
      isTampered:       is_tampered ?? false,
      tamperConfidence: String(tamper_confidence ?? 0),
      riskScore:        String(risk_score ?? 0),
      flags:            flags ?? [],
      metadata:         metadata ?? {},
      analysedAt:       analysed_at ? new Date(analysed_at) : null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("persist/document error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/persist/position ────────────────────────────────────────────────
router.post("/persist/position", async (req, res) => {
  try {
    const { mmsi, lat, lon, speed, heading } = req.body;
    await db.insert(aisPositions).values({
      mmsi,
      lat:     String(lat),
      lon:     String(lon),
      speed:   speed   != null ? String(speed)   : null,
      heading: heading != null ? String(heading) : null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("persist/position error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /api/persist/sanctions ───────────────────────────────────────────────
router.post("/persist/sanctions", async (req, res) => {
  try {
    const { mmsi, vessel_name, regime, list_name, match_type, confidence, reference } = req.body;
    await db.insert(sanctionsHits).values({
      mmsi,
      vesselName: vessel_name ?? null,
      regime,
      listName:   list_name,
      matchType:  match_type,
      confidence: String(confidence ?? 0),
      reference:  reference ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("persist/sanctions error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/health/ai ────────────────────────────────────────────────────────
router.get("/health/ai", async (_req, res) => {
  try {
    await db.select({ c: sql<number>`1` }).from(portIntelligence).limit(1);
    res.json({ ok: true, timestamp: new Date().toISOString(), services: { db: true } });
  } catch {
    res.json({ ok: false, timestamp: new Date().toISOString(), services: { db: false } });
  }
});

export default router;
