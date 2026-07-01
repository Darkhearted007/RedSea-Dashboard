/**
 * Port Intelligence & OSINT Enrichment
 * Inspired by: reverse-skill/skills/field-journal + browser-automation
 *
 * Enriches vessel and port data with:
 * - Port authority status feeds
 * - Sanctions list cross-referencing (OFAC, UN, EU)
 * - Vessel ownership chain resolution
 * - Route history anomaly detection
 * - Port congestion & delay intelligence
 * - Dark vessel event correlation
 */

export interface PortProfile {
  portCode: string        // UN/LOCODE
  name: string
  country: string
  lat: number
  lon: number
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  sanctions: string[]     // list of applicable sanctions regimes
  lastIncident?: string
  congestionLevel?: "CLEAR" | "MODERATE" | "HEAVY" | "CLOSED"
  notes: string[]
}

export interface VesselIntelligence {
  mmsi: string
  imoNumber?: string
  vesselName?: string
  flagState?: string
  ownershipChain?: string[]
  sanctionHits: SanctionHit[]
  portCallHistory: PortCall[]
  riskIndicators: string[]
  enrichedAt: number
}

export interface SanctionHit {
  regime: "OFAC" | "UN" | "EU" | "UK" | "AU"
  listName: string
  matchType: "MMSI" | "IMO" | "NAME" | "OWNER"
  confidence: number
  reference?: string
}

export interface PortCall {
  portCode: string
  portName: string
  arrivalTime?: string
  departureTime?: string
  durationHours?: number
  flaggedReason?: string
}

// ─── Static Port Risk Database ────────────────────────────────────────────────
// In production: replace with live API from MarineTraffic, VesselFinder, or AIS Hub

const PORT_RISK_DB: Record<string, Partial<PortProfile>> = {
  "NGLAG": {
    name: "Lagos (Apapa)",
    country: "Nigeria",
    lat: 6.44,
    lon: 3.39,
    riskLevel: "MEDIUM",
    sanctions: [],
    notes: ["High congestion typical", "Verify port authority clearance"],
  },
  "GHTEM": {
    name: "Tema Port",
    country: "Ghana",
    lat: 5.62,
    lon: -0.02,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Regional transshipment hub", "ECOWAS compliant"],
  },
  "KETIZ": {
    name: "Mombasa",
    country: "Kenya",
    lat: -4.04,
    lon: 39.67,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Major East Africa gateway"],
  },
  "ZADUR": {
    name: "Durban",
    country: "South Africa",
    lat: -29.87,
    lon: 31.03,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Busiest African container port"],
  },
  "IRBAN": {
    name: "Bandar Abbas",
    country: "Iran",
    lat: 27.18,
    lon: 56.27,
    riskLevel: "CRITICAL",
    sanctions: ["OFAC", "EU", "UN", "UK"],
    notes: [
      "Subject to comprehensive sanctions",
      "All transactions require OFAC license",
      "High ship-to-ship transfer activity nearby",
    ],
  },
  "SYJDH": {
    name: "Jeddah Islamic Port",
    country: "Saudi Arabia",
    lat: 21.49,
    lon: 39.17,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Major Red Sea hub", "Verify transit documentation carefully"],
  },
}

// ─── Sanctions Screening ──────────────────────────────────────────────────────

// Mock sanctions data — in production: query OFAC SDN API, UN Security Council list
const SANCTIONED_VESSELS: Record<string, SanctionHit[]> = {
  "123456789": [
    {
      regime: "OFAC",
      listName: "Specially Designated Nationals (SDN)",
      matchType: "MMSI",
      confidence: 1.0,
      reference: "SDN-2024-SHIP-001",
    },
  ],
  "987654321": [
    {
      regime: "UN",
      listName: "DPRK Vessel Sanctions",
      matchType: "MMSI",
      confidence: 0.95,
      reference: "UNSC-1718",
    },
    {
      regime: "EU",
      listName: "EU Restrictive Measures",
      matchType: "MMSI",
      confidence: 0.9,
      reference: "EU-2022-263",
    },
  ],
}

export function screenVesselSanctions(mmsi: string, vesselName?: string): SanctionHit[] {
  const hits: SanctionHit[] = []

  // Direct MMSI hit
  if (SANCTIONED_VESSELS[mmsi]) {
    hits.push(...SANCTIONED_VESSELS[mmsi])
  }

  // Fuzzy name match (in production: use Levenshtein distance against full SDN list)
  if (vesselName) {
    const sanctionedNames = ["AL WAHEED", "OCEAN STAR 7", "HONG BAO"]
    for (const name of sanctionedNames) {
      if (vesselName.toUpperCase().includes(name)) {
        hits.push({
          regime: "OFAC",
          listName: "SDN Vessel Name Match",
          matchType: "NAME",
          confidence: 0.8,
          reference: "SDN-NAME-MATCH",
        })
      }
    }
  }

  return hits
}

// ─── Port Intelligence Resolver ───────────────────────────────────────────────

export function resolvePortProfile(portCode: string): PortProfile {
  const db = PORT_RISK_DB[portCode.toUpperCase()]

  if (db) {
    return {
      portCode: portCode.toUpperCase(),
      name: db.name || portCode,
      country: db.country || "Unknown",
      lat: db.lat || 0,
      lon: db.lon || 0,
      riskLevel: db.riskLevel || "LOW",
      sanctions: db.sanctions || [],
      notes: db.notes || [],
      congestionLevel: db.congestionLevel || "CLEAR",
    }
  }

  return {
    portCode: portCode.toUpperCase(),
    name: portCode,
    country: "Unknown",
    lat: 0,
    lon: 0,
    riskLevel: "MEDIUM", // unknown ports default to MEDIUM — verify manually
    sanctions: [],
    notes: ["Port not in RedSea intelligence database — manual verification recommended"],
    congestionLevel: "CLEAR",
  }
}

// ─── Vessel Intelligence Enrichment ──────────────────────────────────────────

export function enrichVesselIntelligence(
  mmsi: string,
  vesselName?: string,
  portHistory?: string[]
): VesselIntelligence {
  const sanctionHits = screenVesselSanctions(mmsi, vesselName)
  const riskIndicators: string[] = []

  // Resolve port call risk
  const portCallHistory: PortCall[] = (portHistory || []).map(portCode => {
    const profile = resolvePortProfile(portCode)
    const portCall: PortCall = {
      portCode,
      portName: profile.name,
    }

    if (profile.riskLevel === "HIGH" || profile.riskLevel === "CRITICAL") {
      portCall.flaggedReason = `High-risk port: ${profile.riskLevel}`
      riskIndicators.push(`Called at high-risk port: ${profile.name} (${portCode})`)
    }

    if (profile.sanctions.length > 0) {
      portCall.flaggedReason = `Sanctioned port — regimes: ${profile.sanctions.join(", ")}`
      riskIndicators.push(`Sanctioned port call: ${profile.name} — ${profile.sanctions.join(", ")}`)
    }

    return portCall
  })

  // Add sanction indicators
  for (const hit of sanctionHits) {
    riskIndicators.push(`${hit.regime} sanction match: ${hit.listName} (confidence: ${(hit.confidence * 100).toFixed(0)}%)`)
  }

  return {
    mmsi,
    vesselName,
    sanctionHits,
    portCallHistory,
    riskIndicators,
    enrichedAt: Date.now(),
  }
}

// ─── Route Anomaly Detector ───────────────────────────────────────────────────

export interface RouteAnomaly {
  type: "DEVIATION" | "DARK_PERIOD" | "LOITERING" | "SANCTIONED_WATERS"
  description: string
  severity: "LOW" | "MEDIUM" | "HIGH"
  timestamp: number
}

export function detectRouteAnomalies(
  positions: Array<{ lat: number; lon: number; timestamp: number; speed: number }>
): RouteAnomaly[] {
  const anomalies: RouteAnomaly[] = []

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1]
    const curr = positions[i]
    const gapHours = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60)

    // Dark period: no AIS signal for > 6 hours while underway
    if (gapHours > 6 && prev.speed > 2) {
      anomalies.push({
        type: "DARK_PERIOD",
        description: `AIS signal gap of ${gapHours.toFixed(1)} hours while vessel was underway — possible transponder shutdown`,
        severity: gapHours > 24 ? "HIGH" : "MEDIUM",
        timestamp: curr.timestamp,
      })
    }

    // Loitering: slow speed in open ocean for extended period
    if (curr.speed < 1 && gapHours > 2) {
      anomalies.push({
        type: "LOITERING",
        description: `Vessel loitering at ${curr.lat.toFixed(3)}, ${curr.lon.toFixed(3)} for >${gapHours.toFixed(1)} hours`,
        severity: "LOW",
        timestamp: curr.timestamp,
      })
    }

    // Sanctioned waters check (Persian Gulf / North Korea EEZ examples)
    const inPersianGulf = curr.lat >= 23 && curr.lat <= 30 && curr.lon >= 48 && curr.lon <= 57
    if (inPersianGulf) {
      anomalies.push({
        type: "SANCTIONED_WATERS",
        description: "Vessel detected in Persian Gulf — enhanced due diligence required per OFAC guidelines",
        severity: "MEDIUM",
        timestamp: curr.timestamp,
      })
    }
  }

  return anomalies
}

// ─── Intelligence Summary ─────────────────────────────────────────────────────

export function buildIntelligenceSummary(
  vessel: VesselIntelligence,
  routeAnomalies: RouteAnomaly[]
): { overallRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; summary: string } {
  const criticalFlags = [
    ...vessel.sanctionHits.filter(h => h.confidence >= 0.9),
    ...routeAnomalies.filter(a => a.severity === "HIGH"),
  ]

  const highFlags = [
    ...vessel.sanctionHits.filter(h => h.confidence >= 0.7),
    ...vessel.portCallHistory.filter(p => p.flaggedReason),
    ...routeAnomalies.filter(a => a.severity === "MEDIUM"),
  ]

  let overallRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW"
  if (criticalFlags.length > 0) overallRisk = "CRITICAL"
  else if (highFlags.length >= 2) overallRisk = "HIGH"
  else if (highFlags.length >= 1) overallRisk = "MEDIUM"

  const parts = [`Vessel ${vessel.mmsi} — Risk: ${overallRisk}`]
  if (vessel.sanctionHits.length > 0) parts.push(`${vessel.sanctionHits.length} sanction hit(s)`)
  if (routeAnomalies.length > 0) parts.push(`${routeAnomalies.length} route anomaly/anomalies`)
  if (vessel.riskIndicators.length > 0) parts.push(vessel.riskIndicators[0])

  return { overallRisk, summary: parts.join(" | ") }
}
