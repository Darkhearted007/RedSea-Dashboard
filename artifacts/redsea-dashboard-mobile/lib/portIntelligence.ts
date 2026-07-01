export interface SanctionHit {
  regime: "OFAC" | "UN" | "EU" | "UK" | "AU"
  listName: string
  matchType: "MMSI" | "IMO" | "NAME" | "OWNER"
  confidence: number
  reference?: string
}

export interface VesselIntelligence {
  mmsi: string
  vesselName?: string
  sanctionHits: SanctionHit[]
  riskIndicators: string[]
  enrichedAt: number
}

const SANCTIONS_DB: Record<string, { regime: "OFAC" | "UN" | "EU" | "UK" | "AU"; listName: string; reference: string }[]> = {
  "567123456": [{ regime: "OFAC", listName: "SDN List", reference: "IRAN-0001" }],
  "432567890": [{ regime: "UN", listName: "UN Consolidated", reference: "UN-2231" }],
}

const VESSEL_NAME_SANCTIONS: Record<string, SanctionHit[]> = {
  "ARYA STAR": [{ regime: "EU", listName: "EU Consolidated", matchType: "NAME", confidence: 0.92 }],
  "FORTUNE": [{ regime: "OFAC", listName: "SDN List", matchType: "NAME", confidence: 0.75 }],
}

function screenVesselSanctions(mmsi: string, vesselName?: string): SanctionHit[] {
  const hits: SanctionHit[] = []
  const mmsiHits = SANCTIONS_DB[mmsi]
  if (mmsiHits) {
    for (const h of mmsiHits) {
      hits.push({ ...h, matchType: "MMSI", confidence: 0.99 })
    }
  }
  if (vesselName) {
    const nameHits = VESSEL_NAME_SANCTIONS[vesselName.toUpperCase().trim()]
    if (nameHits) hits.push(...nameHits)
  }
  return hits
}

export function enrichVesselIntelligence(mmsi: string, vesselName?: string): VesselIntelligence {
  const sanctionHits = screenVesselSanctions(mmsi, vesselName)
  const riskIndicators: string[] = []
  for (const hit of sanctionHits) {
    riskIndicators.push(`${hit.regime} sanctions hit: ${hit.listName} (${(hit.confidence * 100).toFixed(0)}% confidence)`)
  }
  return {
    mmsi,
    vesselName,
    sanctionHits,
    riskIndicators,
    enrichedAt: Date.now(),
  }
}
