/**
 * RedSea Persistence Layer
 * All Supabase reads/writes in one place.
 * Uses anon key for reads, service_role (server-side) for writes.
 * Client-side writes go through Next.js API routes to avoid exposing service key.
 */

import { supabase } from "./client"
import type { VesselThreatProfile, AnomalyFlag } from "@/lib/security/aisAnomalyDetector"
import type { DocumentAnalysisResult } from "@/lib/security/documentTamperDetector"
import type { SanctionHit } from "@/lib/intelligence/portIntelligence"

// ─── Types matching DB schema ─────────────────────────────────────────────────

export interface DBViolation {
  mmsi: string
  flag_code: string
  severity: string
  description: string
  threat_score: number
  lat?: number
  lon?: number
}

export interface DBPosition {
  mmsi: string
  lat: number
  lon: number
  speed?: number
  heading?: number
}

// ─── Violation Log ────────────────────────────────────────────────────────────

export async function persistViolation(
  mmsi: string,
  flag: AnomalyFlag,
  score: number,
  lat?: number,
  lon?: number
): Promise<void> {
  try {
    await fetch("/api/persist/violation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mmsi,
        flag_code: flag.code,
        severity: flag.severity,
        description: flag.description,
        threat_score: score,
        lat,
        lon,
      } satisfies DBViolation),
    })
  } catch (err) {
    console.error("❌ persistViolation failed:", err)
  }
}

export async function fetchViolations(limit = 50) {
  const { data, error } = await supabase
    .from("violation_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) console.error("❌ fetchViolations:", error.message)
  return data || []
}

// ─── Vessel Threat Profiles ───────────────────────────────────────────────────

export async function persistThreatProfile(
  profile: VesselThreatProfile,
  lat?: number,
  lon?: number,
  speed?: number,
  heading?: number,
  vesselName?: string
): Promise<void> {
  try {
    await fetch("/api/persist/threat-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mmsi: profile.mmsi,
        threat_level: profile.threatLevel,
        score: profile.score,
        flags: profile.flags,
        last_lat: lat,
        last_lon: lon,
        last_speed: speed,
        last_heading: heading,
        vessel_name: vesselName,
        updated_at: new Date().toISOString(),
      }),
    })
  } catch (err) {
    console.error("❌ persistThreatProfile failed:", err)
  }
}

export async function fetchTopThreats(limit = 20) {
  const { data, error } = await supabase
    .from("vessel_threat_profiles")
    .select("*")
    .in("threat_level", ["HIGH", "CRITICAL"])
    .order("score", { ascending: false })
    .limit(limit)

  if (error) console.error("❌ fetchTopThreats:", error.message)
  return data || []
}

export async function fetchAllVesselProfiles(limit = 500) {
  const { data, error } = await supabase
    .from("vessel_threat_profiles")
    .select("*")
    .order("score", { ascending: false })
    .limit(limit)

  if (error) console.error("❌ fetchAllVesselProfiles:", error.message)
  return data || []
}

export async function fetchThreatProfile(mmsi: string) {
  const { data, error } = await supabase
    .from("vessel_threat_profiles")
    .select("*")
    .eq("mmsi", mmsi)
    .single()

  if (error && error.code !== "PGRST116") console.error("❌ fetchThreatProfile:", error.message)
  return data
}

// ─── Document Registry ────────────────────────────────────────────────────────

export async function persistDocumentResult(
  result: DocumentAnalysisResult,
  chainHash: string,
  previousHash: string
): Promise<void> {
  try {
    await fetch("/api/persist/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: result.documentId,
        file_name: result.fileName,
        file_hash: result.fileHash,
        previous_hash: previousHash,
        chain_hash: chainHash,
        document_type: result.documentType,
        is_tampered: result.isTampered,
        tamper_confidence: result.tamperConfidence,
        risk_score: result.riskScore,
        flags: result.flags,
        metadata: result.metadata,
        analysed_at: new Date(result.analysedAt).toISOString(),
      }),
    })
  } catch (err) {
    console.error("❌ persistDocumentResult failed:", err)
  }
}

export async function fetchDocumentRegistry(limit = 20) {
  const { data, error } = await supabase
    .from("document_registry")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) console.error("❌ fetchDocumentRegistry:", error.message)
  return data || []
}

export async function fetchDocumentByHash(fileHash: string) {
  const { data, error } = await supabase
    .from("document_registry")
    .select("*")
    .eq("file_hash", fileHash)
    .single()

  if (error && error.code !== "PGRST116") console.error("❌ fetchDocumentByHash:", error.message)
  return data
}

// ─── Port Intelligence ────────────────────────────────────────────────────────

export async function fetchPortProfiles() {
  const { data, error } = await supabase
    .from("port_intelligence")
    .select("*")
    .order("risk_level", { ascending: false })

  if (error) console.error("❌ fetchPortProfiles:", error.message)
  return data || []
}

export async function fetchPortProfile(portCode: string) {
  const { data, error } = await supabase
    .from("port_intelligence")
    .select("*")
    .eq("port_code", portCode.toUpperCase())
    .single()

  if (error && error.code !== "PGRST116") console.error("❌ fetchPortProfile:", error.message)
  return data
}

// ─── Sanctions Hits ───────────────────────────────────────────────────────────

export async function persistSanctionsHit(
  mmsi: string,
  vesselName: string | undefined,
  hit: SanctionHit
): Promise<void> {
  try {
    await fetch("/api/persist/sanctions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mmsi,
        vessel_name: vesselName,
        regime: hit.regime,
        list_name: hit.listName,
        match_type: hit.matchType,
        confidence: hit.confidence,
        reference: hit.reference,
      }),
    })
  } catch (err) {
    console.error("❌ persistSanctionsHit failed:", err)
  }
}

export async function fetchSanctionsHistory(mmsi?: string) {
  let query = supabase
    .from("sanctions_hits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (mmsi) query = query.eq("mmsi", mmsi)

  const { data, error } = await query
  if (error) console.error("❌ fetchSanctionsHistory:", error.message)
  return data || []
}

// ─── AIS Position History ─────────────────────────────────────────────────────

// Throttled position writer — only writes every 60s per vessel to avoid flooding
const lastPositionWrite = new Map<string, number>()
const POSITION_WRITE_INTERVAL_MS = 60_000

export async function persistPosition(pos: DBPosition): Promise<void> {
  const now = Date.now()
  const last = lastPositionWrite.get(pos.mmsi) || 0
  if (now - last < POSITION_WRITE_INTERVAL_MS) return

  lastPositionWrite.set(pos.mmsi, now)

  try {
    await fetch("/api/persist/position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pos),
    })
  } catch (err) {
    console.error("❌ persistPosition failed:", err)
  }
}

export async function fetchVesselTrack(mmsi: string, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("ais_positions")
    .select("lat, lon, speed, heading, recorded_at")
    .eq("mmsi", mmsi)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true })

  if (error) console.error("❌ fetchVesselTrack:", error.message)
  return data || []
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function fetchDashboardStats() {
  const [violations, threats, documents, sanctions] = await Promise.all([
    supabase.from("violation_log").select("id", { count: "exact", head: true }),
    supabase.from("vessel_threat_profiles").select("threat_level").in("threat_level", ["HIGH", "CRITICAL"]),
    supabase.from("document_registry").select("is_tampered"),
    supabase.from("sanctions_hits").select("id", { count: "exact", head: true }),
  ])

  return {
    totalViolations: violations.count || 0,
    activeHighThreats: threats.data?.length || 0,
    documentsScanned: documents.data?.length || 0,
    tamperedDocuments: documents.data?.filter(d => d.is_tampered).length || 0,
    sanctionsHits: sanctions.count || 0,
  }
}
