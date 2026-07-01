-- ============================================================
-- RedSea Dashboard — Supabase Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. Violation Log ────────────────────────────────────────
-- Every HIGH/CRITICAL AIS threat flag gets logged here
CREATE TABLE IF NOT EXISTS violation_log (
  id            BIGSERIAL PRIMARY KEY,
  mmsi          TEXT NOT NULL,
  flag_code     TEXT NOT NULL,
  severity      TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  description   TEXT NOT NULL,
  threat_score  INTEGER DEFAULT 0,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_violation_log_mmsi ON violation_log(mmsi);
CREATE INDEX idx_violation_log_created ON violation_log(created_at DESC);
CREATE INDEX idx_violation_log_severity ON violation_log(severity);

-- ─── 2. Vessel Threat Profiles ───────────────────────────────
-- Latest threat profile per vessel (upsert on mmsi)
CREATE TABLE IF NOT EXISTS vessel_threat_profiles (
  mmsi            TEXT PRIMARY KEY,
  threat_level    TEXT NOT NULL CHECK (threat_level IN ('CLEAN','LOW','MEDIUM','HIGH','CRITICAL')),
  score           INTEGER NOT NULL DEFAULT 0,
  flags           JSONB DEFAULT '[]',
  last_lat        DOUBLE PRECISION,
  last_lon        DOUBLE PRECISION,
  last_speed      DOUBLE PRECISION,
  last_heading    DOUBLE PRECISION,
  vessel_name     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threat_profiles_level ON vessel_threat_profiles(threat_level);
CREATE INDEX idx_threat_profiles_score ON vessel_threat_profiles(score DESC);

-- ─── 3. Document Registry (Hash-Chained Audit Trail) ─────────
-- Tamper detection results — mirrors Osanvault-Verify architecture
CREATE TABLE IF NOT EXISTS document_registry (
  id                BIGSERIAL PRIMARY KEY,
  document_id       TEXT UNIQUE NOT NULL,
  file_name         TEXT NOT NULL,
  file_hash         TEXT NOT NULL,
  previous_hash     TEXT NOT NULL DEFAULT repeat('0', 64),
  chain_hash        TEXT NOT NULL,
  document_type     TEXT NOT NULL,
  is_tampered       BOOLEAN NOT NULL DEFAULT FALSE,
  tamper_confidence TEXT NOT NULL CHECK (tamper_confidence IN ('NONE','LOW','MEDIUM','HIGH','DEFINITIVE')),
  risk_score        INTEGER NOT NULL DEFAULT 0,
  flags             JSONB DEFAULT '[]',
  metadata          JSONB DEFAULT '{}',
  analysed_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_registry_hash ON document_registry(file_hash);
CREATE INDEX idx_doc_registry_tampered ON document_registry(is_tampered);
CREATE INDEX idx_doc_registry_created ON document_registry(created_at DESC);

-- ─── 4. Port Intelligence Cache ──────────────────────────────
-- Cached port risk profiles and OSINT enrichment
CREATE TABLE IF NOT EXISTS port_intelligence (
  port_code         TEXT PRIMARY KEY,
  port_name         TEXT NOT NULL,
  country           TEXT NOT NULL,
  lat               DOUBLE PRECISION,
  lon               DOUBLE PRECISION,
  risk_level        TEXT NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  sanctions         TEXT[] DEFAULT '{}',
  congestion_level  TEXT CHECK (congestion_level IN ('CLEAR','MODERATE','HEAVY','CLOSED')),
  notes             TEXT[] DEFAULT '{}',
  last_incident     TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Sanctions Hits ───────────────────────────────────────
-- Persistent record of every sanctions match
CREATE TABLE IF NOT EXISTS sanctions_hits (
  id            BIGSERIAL PRIMARY KEY,
  mmsi          TEXT NOT NULL,
  vessel_name   TEXT,
  regime        TEXT NOT NULL CHECK (regime IN ('OFAC','UN','EU','UK','AU')),
  list_name     TEXT NOT NULL,
  match_type    TEXT NOT NULL CHECK (match_type IN ('MMSI','IMO','NAME','OWNER')),
  confidence    DOUBLE PRECISION NOT NULL,
  reference     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sanctions_mmsi ON sanctions_hits(mmsi);
CREATE INDEX idx_sanctions_regime ON sanctions_hits(regime);

-- ─── 6. AIS Position History (time-series) ───────────────────
-- Rolling 7-day position track per vessel
CREATE TABLE IF NOT EXISTS ais_positions (
  id          BIGSERIAL PRIMARY KEY,
  mmsi        TEXT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL,
  speed       DOUBLE PRECISION,
  heading     DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_mmsi_time ON ais_positions(mmsi, recorded_at DESC);
CREATE INDEX idx_positions_time ON ais_positions(recorded_at DESC);

-- Auto-delete positions older than 7 days (keep table lean)
-- Run this as a cron job in Supabase → Database → Extensions → pg_cron
-- SELECT cron.schedule('cleanup-old-positions', '0 2 * * *', 
--   $$DELETE FROM ais_positions WHERE recorded_at < NOW() - INTERVAL '7 days'$$);

-- ─── 7. Row Level Security ───────────────────────────────────
-- RLS enabled on all tables (read-only for anon, full access for service role)

ALTER TABLE violation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_threat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ais_positions ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated reads on non-sensitive tables
CREATE POLICY "public read port_intelligence"
  ON port_intelligence FOR SELECT USING (true);

-- All writes require service_role (backend only — not exposed to browser)
CREATE POLICY "service_role write violation_log"
  ON violation_log FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role write vessel_threat_profiles"
  ON vessel_threat_profiles FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role write document_registry"
  ON document_registry FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role write sanctions_hits"
  ON sanctions_hits FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role write ais_positions"
  ON ais_positions FOR ALL USING (auth.role() = 'service_role');

-- Read policy for document_registry (users can view their own scans)
CREATE POLICY "authenticated read document_registry"
  ON document_registry FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "authenticated read violation_log"
  ON violation_log FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "authenticated read vessel_threat_profiles"
  ON vessel_threat_profiles FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "authenticated read sanctions_hits"
  ON sanctions_hits FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "authenticated read ais_positions"
  ON ais_positions FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- ─── 8. Seed Port Intelligence ───────────────────────────────
INSERT INTO port_intelligence (port_code, port_name, country, lat, lon, risk_level, sanctions, notes) VALUES
  ('NGLAG', 'Lagos (Apapa)', 'Nigeria', 6.44, 3.39, 'MEDIUM', '{}', ARRAY['High congestion typical', 'Verify port authority clearance']),
  ('GHTEM', 'Tema Port', 'Ghana', 5.62, -0.02, 'LOW', '{}', ARRAY['Regional transshipment hub', 'ECOWAS compliant']),
  ('KETIZ', 'Mombasa', 'Kenya', -4.04, 39.67, 'LOW', '{}', ARRAY['Major East Africa gateway']),
  ('ZADUR', 'Durban', 'South Africa', -29.87, 31.03, 'LOW', '{}', ARRAY['Busiest African container port']),
  ('IRBAN', 'Bandar Abbas', 'Iran', 27.18, 56.27, 'CRITICAL', ARRAY['OFAC','EU','UN','UK'], ARRAY['Subject to comprehensive sanctions', 'All transactions require OFAC license', 'High ship-to-ship transfer activity nearby']),
  ('SYJDH', 'Jeddah Islamic Port', 'Saudi Arabia', 21.49, 39.17, 'LOW', '{}', ARRAY['Major Red Sea hub', 'Verify transit documentation carefully']),
  ('EGPSD', 'Port Said', 'Egypt', 31.27, 32.30, 'LOW', '{}', ARRAY['Suez Canal northern entrance', 'High traffic volume']),
  ('DJJIB', 'Djibouti Port', 'Djibouti', 11.60, 43.14, 'MEDIUM', '{}', ARRAY['Strategic Red Sea chokepoint', 'Military presence nearby']),
  ('YEMKH', 'Mukalla', 'Yemen', 14.52, 49.13, 'CRITICAL', '{}', ARRAY['Active conflict zone', 'No commercial operations recommended']),
  ('SDPZH', 'Port Sudan', 'Sudan', 19.62, 37.22, 'HIGH', '{}', ARRAY['Political instability', 'Verify clearances carefully'])
ON CONFLICT (port_code) DO NOTHING;

-- ─── Done ─────────────────────────────────────────────────────
-- Tables created: violation_log, vessel_threat_profiles, document_registry,
--                 port_intelligence, sanctions_hits, ais_positions
-- RLS enabled on all tables
-- Port intelligence seeded with 10 African/Red Sea ports
