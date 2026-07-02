import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── violation_log ─────────────────────────────────────────────────────────────
export const violationLog = pgTable("violation_log", {
  id:          uuid("id").primaryKey().defaultRandom(),
  mmsi:        text("mmsi").notNull(),
  flagCode:    text("flag_code").notNull(),
  severity:    text("severity").notNull(),
  description: text("description").notNull(),
  threatScore: numeric("threat_score").default("0"),
  lat:         numeric("lat"),
  lon:         numeric("lon"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── vessel_threat_profiles ────────────────────────────────────────────────────
export const vesselThreatProfiles = pgTable("vessel_threat_profiles", {
  id:          uuid("id").primaryKey().defaultRandom(),
  mmsi:        text("mmsi").unique().notNull(),
  vesselName:  text("vessel_name"),
  threatLevel: text("threat_level").notNull().default("CLEAN"),
  score:       numeric("score").default("0"),
  flags:       jsonb("flags").default([]),
  lastLat:     numeric("last_lat"),
  lastLon:     numeric("last_lon"),
  lastSpeed:   numeric("last_speed"),
  lastHeading: numeric("last_heading"),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── document_registry ─────────────────────────────────────────────────────────
export const documentRegistry = pgTable("document_registry", {
  id:               uuid("id").primaryKey().defaultRandom(),
  documentId:       text("document_id").notNull(),
  fileName:         text("file_name").notNull(),
  fileHash:         text("file_hash").notNull(),
  previousHash:     text("previous_hash"),
  chainHash:        text("chain_hash"),
  documentType:     text("document_type"),
  isTampered:       boolean("is_tampered").default(false),
  tamperConfidence: numeric("tamper_confidence").default("0"),
  riskScore:        numeric("risk_score").default("0"),
  flags:            jsonb("flags").default([]),
  metadata:         jsonb("metadata").default({}),
  analysedAt:       timestamp("analysed_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── port_intelligence ─────────────────────────────────────────────────────────
export const portIntelligence = pgTable("port_intelligence", {
  id:               uuid("id").primaryKey().defaultRandom(),
  portCode:         text("port_code").unique().notNull(),
  name:             text("name").notNull(),
  country:          text("country").notNull(),
  lat:              numeric("lat"),
  lon:              numeric("lon"),
  riskLevel:        text("risk_level").default("LOW"),
  sanctions:        jsonb("sanctions").default([]),
  notes:            jsonb("notes").default([]),
  congestionLevel:  text("congestion_level"),
  lastIncident:     text("last_incident"),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── sanctions_hits ────────────────────────────────────────────────────────────
export const sanctionsHits = pgTable("sanctions_hits", {
  id:         uuid("id").primaryKey().defaultRandom(),
  mmsi:       text("mmsi").notNull(),
  vesselName: text("vessel_name"),
  regime:     text("regime").notNull(),
  listName:   text("list_name").notNull(),
  matchType:  text("match_type").notNull(),
  confidence: numeric("confidence").default("0"),
  reference:  text("reference"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── ais_positions ─────────────────────────────────────────────────────────────
export const aisPositions = pgTable("ais_positions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  mmsi:       text("mmsi").notNull(),
  lat:        numeric("lat").notNull(),
  lon:        numeric("lon").notNull(),
  speed:      numeric("speed"),
  heading:    numeric("heading"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
});

// ── re-export types ───────────────────────────────────────────────────────────
export type ViolationLog         = typeof violationLog.$inferSelect;
export type VesselThreatProfile  = typeof vesselThreatProfiles.$inferSelect;
export type DocumentRegistry     = typeof documentRegistry.$inferSelect;
export type PortIntelligence     = typeof portIntelligence.$inferSelect;
export type SanctionsHit         = typeof sanctionsHits.$inferSelect;
export type AisPosition          = typeof aisPositions.$inferSelect;
