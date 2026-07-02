/**
 * RedSea Persistence Layer
 * All reads/writes go through the API server — no direct Supabase access.
 */

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
  try {
    const res = await fetch(`/api/violations?limit=${limit}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
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
  try {
    const res = await fetch(`/api/vessels/threats?limit=${limit}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function fetchAllVesselProfiles(limit = 500) {
  try {
    const res = await fetch(`/api/vessels?limit=${limit}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function fetchThreatProfile(mmsi: string) {
  try {
    const res = await fetch(`/api/vessels/${encodeURIComponent(mmsi)}/profile`)
    if (res.status === 404) return null
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
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
  try {
    const res = await fetch(`/api/documents?limit=${limit}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function fetchDocumentByHash(fileHash: string) {
  try {
    const res = await fetch(`/api/documents/by-hash/${encodeURIComponent(fileHash)}`)
    if (res.status === 404) return null
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Port Intelligence ────────────────────────────────────────────────────────

export async function fetchPortProfiles() {
  try {
    const res = await fetch("/api/ports")
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function fetchPortProfile(portCode: string) {
  try {
    const res = await fetch(`/api/ports/${encodeURIComponent(portCode)}`)
    if (res.status === 404) return null
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
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
  try {
    const url = mmsi
      ? `/api/sanctions?mmsi=${encodeURIComponent(mmsi)}`
      : "/api/sanctions"
    const res = await fetch(url)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// ─── AIS Positions ────────────────────────────────────────────────────────────

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
  try {
    const res = await fetch(`/api/vessels/${encodeURIComponent(mmsi)}/track?hours=${hours}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function fetchDashboardStats() {
  try {
    const res = await fetch("/api/dashboard/stats")
    if (!res.ok) return {
      totalViolations: 0, activeHighThreats: 0,
      documentsScanned: 0, tamperedDocuments: 0, sanctionsHits: 0,
    }
    return await res.json()
  } catch {
    return {
      totalViolations: 0, activeHighThreats: 0,
      documentsScanned: 0, tamperedDocuments: 0, sanctionsHits: 0,
    }
  }
}
