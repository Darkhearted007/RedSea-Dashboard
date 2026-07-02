/**
 * Read-only query routes — replace direct Supabase reads in the frontend.
 * All responses use snake_case field names to match the legacy Supabase contract.
 */
import { Router } from "express";
import {
  db,
  violationLog,
  vesselThreatProfiles,
  documentRegistry,
  portIntelligence,
  sanctionsHits,
  aisPositions,
} from "@workspace/db";
import { desc, eq, inArray, sql } from "drizzle-orm";

const router = Router();

// ── snake_case mappers ────────────────────────────────────────────────────────

function vesselToSnake(r: typeof vesselThreatProfiles.$inferSelect) {
  return {
    id: r.id, mmsi: r.mmsi,
    vessel_name: r.vesselName, threat_level: r.threatLevel,
    score: r.score, flags: r.flags,
    last_lat: r.lastLat, last_lon: r.lastLon,
    last_speed: r.lastSpeed, last_heading: r.lastHeading,
    updated_at: r.updatedAt, created_at: r.createdAt,
  };
}

function violationToSnake(r: typeof violationLog.$inferSelect) {
  return {
    id: r.id, mmsi: r.mmsi,
    flag_code: r.flagCode, severity: r.severity,
    description: r.description, threat_score: r.threatScore,
    lat: r.lat, lon: r.lon, created_at: r.createdAt,
  };
}

function documentToSnake(r: typeof documentRegistry.$inferSelect) {
  return {
    id: r.id, document_id: r.documentId,
    file_name: r.fileName, file_hash: r.fileHash,
    previous_hash: r.previousHash, chain_hash: r.chainHash,
    document_type: r.documentType, is_tampered: r.isTampered,
    tamper_confidence: r.tamperConfidence, risk_score: r.riskScore,
    flags: r.flags, metadata: r.metadata,
    analysed_at: r.analysedAt, created_at: r.createdAt,
  };
}

function portToSnake(r: typeof portIntelligence.$inferSelect) {
  return {
    id: r.id, port_code: r.portCode, name: r.name, country: r.country,
    lat: r.lat, lon: r.lon, risk_level: r.riskLevel,
    sanctions: r.sanctions, notes: r.notes,
    congestion_level: r.congestionLevel, last_incident: r.lastIncident,
    updated_at: r.updatedAt,
  };
}

function sanctionToSnake(r: typeof sanctionsHits.$inferSelect) {
  return {
    id: r.id, mmsi: r.mmsi, vessel_name: r.vesselName,
    regime: r.regime, list_name: r.listName, match_type: r.matchType,
    confidence: r.confidence, reference: r.reference, created_at: r.createdAt,
  };
}

function positionToSnake(r: typeof aisPositions.$inferSelect) {
  return {
    id: r.id, mmsi: r.mmsi, lat: r.lat, lon: r.lon,
    speed: r.speed, heading: r.heading, recorded_at: r.recordedAt,
  };
}

// ── GET /api/violations?limit=50 ──────────────────────────────────────────────
router.get("/violations", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db
      .select()
      .from(violationLog)
      .orderBy(desc(violationLog.createdAt))
      .limit(limit);
    res.json(rows.map(violationToSnake));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/vessels/threats?limit=20 ────────────────────────────────────────
router.get("/vessels/threats", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const rows = await db
      .select()
      .from(vesselThreatProfiles)
      .where(inArray(vesselThreatProfiles.threatLevel, ["HIGH", "CRITICAL"]))
      .orderBy(desc(vesselThreatProfiles.score))
      .limit(limit);
    res.json(rows.map(vesselToSnake));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/vessels/:mmsi/profile ────────────────────────────────────────────
router.get("/vessels/:mmsi/profile", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(vesselThreatProfiles)
      .where(eq(vesselThreatProfiles.mmsi, req.params.mmsi))
      .limit(1);
    if (!rows.length) { res.status(404).json({ error: "not found" }); return; }
    res.json(vesselToSnake(rows[0]!));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/vessels/:mmsi/track?hours=24 ────────────────────────────────────
router.get("/vessels/:mmsi/track", async (req, res) => {
  try {
    const hours = Math.min(Number(req.query.hours) || 24, 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(aisPositions)
      .where(
        sql`${aisPositions.mmsi} = ${req.params.mmsi} AND ${aisPositions.recordedAt} >= ${since}`
      )
      .orderBy(aisPositions.recordedAt)
      .limit(2000);
    res.json(rows.map(positionToSnake));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/documents?limit=20 ──────────────────────────────────────────────
router.get("/documents", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const rows = await db
      .select()
      .from(documentRegistry)
      .orderBy(desc(documentRegistry.createdAt))
      .limit(limit);
    res.json(rows.map(documentToSnake));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/documents/by-hash/:hash ─────────────────────────────────────────
router.get("/documents/by-hash/:hash", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(documentRegistry)
      .where(eq(documentRegistry.fileHash, req.params.hash))
      .limit(1);
    if (!rows.length) { res.status(404).json({ error: "not found" }); return; }
    res.json(documentToSnake(rows[0]!));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/ports ────────────────────────────────────────────────────────────
router.get("/ports", async (_req, res) => {
  try {
    const rows = await db.select().from(portIntelligence).orderBy(portIntelligence.name);
    res.json(rows.map(portToSnake));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/ports/:code ──────────────────────────────────────────────────────
router.get("/ports/:code", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(portIntelligence)
      .where(eq(portIntelligence.portCode, req.params.code))
      .limit(1);
    if (!rows.length) { res.status(404).json({ error: "not found" }); return; }
    res.json(portToSnake(rows[0]!));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/sanctions?mmsi=... ───────────────────────────────────────────────
router.get("/sanctions", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    if (req.query.mmsi) {
      const rows = await db
        .select()
        .from(sanctionsHits)
        .where(eq(sanctionsHits.mmsi, String(req.query.mmsi)))
        .orderBy(desc(sanctionsHits.createdAt))
        .limit(limit);
      res.json(rows.map(sanctionToSnake));
      return;
    }
    const rows = await db
      .select()
      .from(sanctionsHits)
      .orderBy(desc(sanctionsHits.createdAt))
      .limit(limit);
    res.json(rows.map(sanctionToSnake));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/dashboard/stats ──────────────────────────────────────────────────
router.get("/dashboard/stats", async (_req, res) => {
  try {
    const [violationsRes, threatsRes, docsRes, sanctionsRes] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(violationLog),
      db
        .select({ threatLevel: vesselThreatProfiles.threatLevel })
        .from(vesselThreatProfiles)
        .where(inArray(vesselThreatProfiles.threatLevel, ["HIGH", "CRITICAL"])),
      db.select({ isTampered: documentRegistry.isTampered }).from(documentRegistry),
      db.select({ count: sql<number>`count(*)` }).from(sanctionsHits),
    ]);

    res.json({
      totalViolations:   Number(violationsRes[0]?.count ?? 0),
      activeHighThreats: threatsRes.length,
      documentsScanned:  docsRes.length,
      tamperedDocuments: docsRes.filter((d) => d.isTampered).length,
      sanctionsHits:     Number(sanctionsRes[0]?.count ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
