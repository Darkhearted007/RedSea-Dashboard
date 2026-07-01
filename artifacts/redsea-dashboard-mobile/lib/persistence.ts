import type { VesselThreatProfile, AnomalyFlag } from "@/lib/aisAnomalyDetector"

const BASE_URL = (): string => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN
  return domain ? `https://${domain}` : ""
}

const lastPositionWrite = new Map<string, number>()
const POSITION_WRITE_INTERVAL_MS = 60_000

export async function fetchAllVesselProfiles(limit = 500): Promise<any[]> {
  try {
    const url = `${BASE_URL()}/api/vessels?limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function persistViolation(
  mmsi: string,
  flag: AnomalyFlag,
  score: number,
  lat?: number,
  lon?: number
): Promise<void> {
  try {
    await fetch(`${BASE_URL()}/api/persist/violation`, {
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
      }),
    })
  } catch (err) {
    console.error("❌ persistViolation failed:", err)
  }
}

export async function persistThreatProfile(
  profile: VesselThreatProfile,
  lat?: number,
  lon?: number,
  speed?: number,
  heading?: number,
  vesselName?: string
): Promise<void> {
  try {
    await fetch(`${BASE_URL()}/api/persist/threat-profile`, {
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

export async function persistSanctionsHit(
  mmsi: string,
  vesselName: string | undefined,
  hit: { regime: string; listName: string; matchType: string; confidence: number; reference?: string }
): Promise<void> {
  try {
    await fetch(`${BASE_URL()}/api/persist/sanctions`, {
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

export interface DBPosition {
  mmsi: string
  lat: number
  lon: number
  speed?: number
  heading?: number
}

export async function persistPosition(pos: DBPosition): Promise<void> {
  const now = Date.now()
  const last = lastPositionWrite.get(pos.mmsi) || 0
  if (now - last < POSITION_WRITE_INTERVAL_MS) return
  lastPositionWrite.set(pos.mmsi, now)
  try {
    await fetch(`${BASE_URL()}/api/persist/position`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pos),
    })
  } catch (err) {
    console.error("❌ persistPosition failed:", err)
  }
}

export async function persistDocumentResult(
  result: {
    documentId: string
    fileName: string
    fileHash: string
    documentType: string
    isTampered: boolean
    tamperConfidence: string
    riskScore: number
    flags: unknown[]
    metadata: unknown
    analysedAt: number
  },
  chainHash: string,
  previousHash: string
): Promise<void> {
  try {
    await fetch(`${BASE_URL()}/api/persist/document`, {
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
