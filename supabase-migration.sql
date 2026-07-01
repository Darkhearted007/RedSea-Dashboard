-- RedSea Ledger — Supabase Schema Migration
-- Run this in your Supabase project: SQL Editor → New query → paste & run

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS violation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi text NOT NULL,
  flag_code text NOT NULL,
  severity text NOT NULL,
  description text NOT NULL,
  threat_score numeric DEFAULT 0,
  lat numeric,
  lon numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vessel_threat_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi text UNIQUE NOT NULL,
  vessel_name text,
  threat_level text NOT NULL DEFAULT 'CLEAN',
  score numeric DEFAULT 0,
  flags jsonb DEFAULT '[]',
  last_lat numeric,
  last_lon numeric,
  last_speed numeric,
  last_heading numeric,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL,
  file_name text NOT NULL,
  file_hash text NOT NULL,
  previous_hash text,
  chain_hash text,
  document_type text,
  is_tampered boolean DEFAULT false,
  tamper_confidence numeric DEFAULT 0,
  risk_score numeric DEFAULT 0,
  flags jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  analysed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS port_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  port_code text UNIQUE NOT NULL,
  name text NOT NULL,
  country text NOT NULL,
  lat numeric,
  lon numeric,
  risk_level text DEFAULT 'LOW',
  sanctions jsonb DEFAULT '[]',
  notes jsonb DEFAULT '[]',
  congestion_level text,
  last_incident text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sanctions_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi text NOT NULL,
  vessel_name text,
  regime text NOT NULL,
  list_name text NOT NULL,
  match_type text NOT NULL,
  confidence numeric DEFAULT 0,
  reference text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ais_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mmsi text NOT NULL,
  lat numeric NOT NULL,
  lon numeric NOT NULL,
  speed numeric,
  heading numeric,
  recorded_at timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_violation_mmsi ON violation_log(mmsi);
CREATE INDEX IF NOT EXISTS idx_violation_created ON violation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vessel_threats_level ON vessel_threat_profiles(threat_level);
CREATE INDEX IF NOT EXISTS idx_ais_positions_mmsi ON ais_positions(mmsi, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sanctions_mmsi ON sanctions_hits(mmsi);

-- ── RLS: disable for service-role bypass ──────────────────────────────────────
-- The API server uses your service_role key, which bypasses RLS automatically.
-- These statements ensure RLS is enabled with a service_role bypass policy
-- so the dashboard can read data with the anon key.

ALTER TABLE violation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_threat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ais_positions ENABLE ROW LEVEL SECURITY;

-- Allow anon reads (for dashboard read queries)
CREATE POLICY IF NOT EXISTS "anon read violation_log"
  ON violation_log FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon read vessel_threat_profiles"
  ON vessel_threat_profiles FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon read document_registry"
  ON document_registry FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon read port_intelligence"
  ON port_intelligence FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon read sanctions_hits"
  ON sanctions_hits FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon read ais_positions"
  ON ais_positions FOR SELECT TO anon USING (true);
