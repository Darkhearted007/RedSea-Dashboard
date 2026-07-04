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

  // ── Africa — Atlantic & Indian Ocean ────────────────────────────────────────
  "NGLAG": {
    name: "Lagos (Apapa)",
    country: "Nigeria",
    lat: 6.44,
    lon: 3.39,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "HEAVY",
    notes: ["High congestion typical", "Verify port authority clearance", "Active crude oil export terminal"],
  },
  "GHTEM": {
    name: "Tema Port",
    country: "Ghana",
    lat: 5.62,
    lon: -0.02,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Regional transshipment hub", "ECOWAS compliant"],
  },
  "CIABJ": {
    name: "Abidjan (San Pedro)",
    country: "Côte d'Ivoire",
    lat: 5.35,
    lon: -4.02,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Largest port in Francophone West Africa", "Cocoa and coffee export hub"],
  },
  "SNDKR": {
    name: "Dakar",
    country: "Senegal",
    lat: 14.69,
    lon: -17.44,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Major West African bunkering hub", "Gateway to Sahel region"],
  },
  "AOLUANDA": {
    name: "Luanda",
    country: "Angola",
    lat: -8.81,
    lon: 13.23,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "HEAVY",
    notes: ["Primary Angolan oil export terminal", "Vessel queuing common — allow 5-10 day delays"],
  },
  "KETIZ": {
    name: "Mombasa",
    country: "Kenya",
    lat: -4.04,
    lon: 39.67,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Major East Africa gateway", "Gateway for landlocked East African states"],
  },
  "ZADUR": {
    name: "Durban",
    country: "South Africa",
    lat: -29.87,
    lon: 31.03,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Busiest African container port", "Key transshipment point for Sub-Saharan Africa"],
  },
  "ZACPT": {
    name: "Cape Town",
    country: "South Africa",
    lat: -33.91,
    lon: 18.42,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Major bulk and container terminal", "Bunkering and ship repair hub", "Watches Cape of Good Hope routing"],
  },
  "MAPTM": {
    name: "Tanger Med",
    country: "Morocco",
    lat: 35.88,
    lon: -5.50,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Largest transshipment hub in Africa", "Strategic Strait of Gibraltar position"],
  },

  // ── Middle East ──────────────────────────────────────────────────────────────
  "IRBAN": {
    name: "Bandar Abbas",
    country: "Iran",
    lat: 27.18,
    lon: 56.27,
    riskLevel: "CRITICAL",
    sanctions: ["OFAC", "EU", "UN", "UK"],
    congestionLevel: "MODERATE",
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
    congestionLevel: "MODERATE",
    notes: ["Major Red Sea hub", "Verify transit documentation carefully"],
  },
  "AEDXB": {
    name: "Port of Dubai (Jebel Ali)",
    country: "UAE",
    lat: 25.01,
    lon: 55.06,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["World's 9th largest container port", "OFAC compliance required for Iranian goods"],
  },
  "YEPOD": {
    name: "Aden",
    country: "Yemen",
    lat: 12.78,
    lon: 45.02,
    riskLevel: "CRITICAL",
    sanctions: [],
    congestionLevel: "CLOSED",
    notes: [
      "Active conflict zone — Houthi maritime threat",
      "IMB recommends vessels avoid within 50nm",
      "Naval escort required for WFP humanitarian traffic",
    ],
  },

  // ── Europe — Atlantic / North Sea ────────────────────────────────────────────
  "NLRTM": {
    name: "Rotterdam",
    country: "Netherlands",
    lat: 51.90,
    lon: 4.47,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Largest port in Europe", "Major oil refining and chemical hub", "EU sanctions compliance strictly enforced"],
  },
  "BEANR": {
    name: "Antwerp",
    country: "Belgium",
    lat: 51.26,
    lon: 4.40,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Europe's second largest container port", "Major diamond trade hub — enhanced due diligence"],
  },
  "DEHAM": {
    name: "Hamburg",
    country: "Germany",
    lat: 53.55,
    lon: 9.99,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Gateway port for Central and Eastern Europe"],
  },
  "FRLEH": {
    name: "Le Havre",
    country: "France",
    lat: 49.49,
    lon: 0.11,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["France's primary container gateway", "Major petroleum imports terminal"],
  },
  "GBFXT": {
    name: "Felixstowe",
    country: "United Kingdom",
    lat: 51.96,
    lon: 1.33,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["UK's busiest container port", "Post-Brexit customs checks apply"],
  },
  "GBSOU": {
    name: "Southampton",
    country: "United Kingdom",
    lat: 50.90,
    lon: -1.40,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["UK's largest cruise port", "Major automotive import hub"],
  },
  "ESBCN": {
    name: "Barcelona",
    country: "Spain",
    lat: 41.35,
    lon: 2.16,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Mediterranean gateway", "Major cruise homeport"],
  },
  "ESALG": {
    name: "Algeciras",
    country: "Spain",
    lat: 36.13,
    lon: -5.45,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Strategic Strait of Gibraltar hub", "Major transshipment for Africa routes"],
  },
  "PTLIS": {
    name: "Lisbon (Sines)",
    country: "Portugal",
    lat: 37.95,
    lon: -8.87,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Western Europe's deepest natural harbour", "Key Atlantic gateway — LNG terminal"],
  },

  // ── North America — East Coast ───────────────────────────────────────────────
  "USNYC": {
    name: "Port of New York & New Jersey",
    country: "United States",
    lat: 40.66,
    lon: -74.05,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Largest US East Coast container port", "CBP strict inspection regime", "TWIC card mandatory for workers"],
  },
  "USSAV": {
    name: "Port of Savannah",
    country: "United States",
    lat: 32.08,
    lon: -81.09,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Fastest-growing US container port", "Major automotive import hub"],
  },
  "USBLT": {
    name: "Baltimore",
    country: "United States",
    lat: 39.27,
    lon: -76.58,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Major ro-ro and vehicle import port", "Key coal export terminal"],
  },
  "USORF": {
    name: "Norfolk (Hampton Roads)",
    country: "United States",
    lat: 36.97,
    lon: -76.33,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Major US Navy base — enhanced security zone", "World's largest coal export terminal"],
  },
  "USMIA": {
    name: "Port of Miami",
    country: "United States",
    lat: 25.77,
    lon: -80.17,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Cruise capital of the world", "Major gateway for Latin American trade"],
  },
  "USCHS": {
    name: "Port of Charleston",
    country: "United States",
    lat: 32.77,
    lon: -79.96,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Major Southeast US container port"],
  },
  "CAHFX": {
    name: "Halifax",
    country: "Canada",
    lat: 44.65,
    lon: -63.57,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Canada's primary Atlantic gateway", "Deepwater port capable of ultra-large vessels"],
  },

  // ── Caribbean & Gulf of Mexico ───────────────────────────────────────────────
  "JMKIN": {
    name: "Kingston",
    country: "Jamaica",
    lat: 17.98,
    lon: -76.79,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Major Caribbean transshipment hub", "Drug trafficking risk — enhanced screening recommended"],
  },
  "TTPOS": {
    name: "Port of Spain",
    country: "Trinidad & Tobago",
    lat: 10.65,
    lon: -61.52,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Energy hub — major LNG exporter", "High drug trafficking interdiction risk"],
  },
  "COBAQ": {
    name: "Barranquilla",
    country: "Colombia",
    lat: 10.96,
    lon: -74.80,
    riskLevel: "HIGH",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Elevated narcotics trafficking risk", "Enhanced customs inspection", "Vessel boarding risk"],
  },
  "PAMIT": {
    name: "Balboa / Cristóbal (Panama Canal)",
    country: "Panama",
    lat: 8.96,
    lon: -79.57,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "HEAVY",
    notes: ["Global chokepoint — monitor transit delays", "Panama Canal congestion impacts global routes", "Vessel queuing 5-20 days typical"],
  },
  "MXVER": {
    name: "Veracruz",
    country: "Mexico",
    lat: 19.20,
    lon: -96.13,
    riskLevel: "HIGH",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Mexico's busiest port", "Elevated cartel-related trafficking risk", "Enhanced due diligence for crew changes"],
  },
  "CUHAV": {
    name: "Havana",
    country: "Cuba",
    lat: 23.14,
    lon: -82.35,
    riskLevel: "HIGH",
    sanctions: ["OFAC"],
    congestionLevel: "CLEAR",
    notes: [
      "Subject to US embargo — OFAC restrictions apply",
      "US-flagged vessels prohibited without license",
      "Financial transactions strictly controlled",
    ],
  },

  // ── South America ─────────────────────────────────────────────────────────────
  "BRSSZ": {
    name: "Santos",
    country: "Brazil",
    lat: -23.96,
    lon: -46.33,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "HEAVY",
    notes: ["Latin America's largest port", "Major soybean and sugar export hub", "Frequent port strikes — monitor vessel delays"],
  },
  "BRRJN": {
    name: "Rio de Janeiro",
    country: "Brazil",
    lat: -22.89,
    lon: -43.22,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Major oil export terminal", "Monitor security situation in port zone"],
  },
  "ARBUE": {
    name: "Buenos Aires",
    country: "Argentina",
    lat: -34.57,
    lon: -58.37,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["South America's major container hub", "Currency controls can delay payments"],
  },
  "CLVAP": {
    name: "Valparaíso",
    country: "Chile",
    lat: -33.03,
    lon: -71.63,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Chile's main container port", "Pacific gateway for Mercosur trade"],
  },
  "COCAR": {
    name: "Cartagena",
    country: "Colombia",
    lat: 10.40,
    lon: -75.52,
    riskLevel: "HIGH",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Major transshipment hub", "Elevated narcotics risk — CBP/USCG enhanced screening", "Drug concealment in containers documented"],
  },

  // ── Mediterranean (strategically relevant) ───────────────────────────────────
  "EGPSD": {
    name: "Port Said (Suez Canal)",
    country: "Egypt",
    lat: 31.26,
    lon: 32.30,
    riskLevel: "MEDIUM",
    sanctions: [],
    congestionLevel: "MODERATE",
    notes: ["Northern Suez Canal entrance — global chokepoint", "Transit delays due to Red Sea rerouting surge"],
  },
  "TRTRI": {
    name: "Trieste",
    country: "Italy",
    lat: 45.65,
    lon: 13.76,
    riskLevel: "LOW",
    sanctions: [],
    congestionLevel: "CLEAR",
    notes: ["Northern Adriatic gateway for Central Europe", "Major oil pipeline terminal"],
  },
  "LYTIP": {
    name: "Tripoli",
    country: "Libya",
    lat: 32.90,
    lon: 13.18,
    riskLevel: "CRITICAL",
    sanctions: ["UN", "EU"],
    congestionLevel: "CLOSED",
    notes: [
      "Active conflict zone",
      "UN arms embargo in effect",
      "Commercial vessel safety cannot be guaranteed",
    ],
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
