/**
 * AIS Anomaly Detection Engine — RedSea AI Platform
 *
 * Multi-layer threat scoring across six intelligence domains:
 *  1. Identity Intelligence  — MMSI / MID / flag validation
 *  2. Motion Intelligence    — speed, acceleration, position jump, teleportation
 *  3. Behaviour Intelligence — loitering, AIS gap, rendezvous, dark vessel
 *  4. Security Intelligence  — exclusion zones, piracy zones, restricted waters
 *  5. Cyber Intelligence     — heading consistency, GPS/AIS injection markers
 *  6. Pattern Intelligence   — circular patrol, oscillation, sudden stop
 */

export type ThreatLevel = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface AnomalyFlag {
  code: string
  description: string
  severity: ThreatLevel
  confidence: number // 0–1
  domain?: string   // which intelligence domain raised this flag
}

export interface VesselThreatProfile {
  mmsi: string
  threatLevel: ThreatLevel
  score: number // 0–100
  flags: AnomalyFlag[]
  lastEvaluated: number
  /** ISO-8601 first-seen timestamp for AIS gap calculation */
  firstSeen?: number
  /** Last known position before any AIS silence */
  lastKnownLat?: number
  lastKnownLon?: number
}

interface VesselSnapshot {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
  timestamp?: number
}

// Historical snapshots keyed by MMSI for delta analysis
const vesselHistory = new Map<string, VesselSnapshot[]>()
const vesselFirstSeen = new Map<string, number>()
const vesselLastSeen = new Map<string, number>()
const MAX_HISTORY = 20

// Known sanctioned MMSI prefixes (example — replace with real OFAC/IMO list)
const SANCTIONED_MMSI_PREFIXES = ["567", "432", "999"]

// Maritime zones  [lat_min, lat_max, lon_min, lon_max]
const EXCLUSION_ZONES = [
  { name: "Strait of Hormuz Restricted", bounds: [25.5, 27.5, 55.5, 57.5] },
  { name: "Gulf of Aden Piracy Zone",    bounds: [11.0, 15.0, 43.0, 55.0] },
  { name: "Red Sea Conflict Area",       bounds: [12.0, 28.0, 32.0, 44.0] },
  { name: "Somali Basin High-Risk Area", bounds: [3.0,  15.0, 47.0, 65.0] },
]

// ─── Haversine Distance Helper ───────────────────────────────────────────────

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── 1. Identity Intelligence ────────────────────────────────────────────────

function checkMMSI(mmsi: string): AnomalyFlag | null {
  if (!/^\d{9}$/.test(mmsi)) {
    return {
      code: "MMSI_INVALID_FORMAT",
      description: `MMSI ${mmsi} fails 9-digit format check — possible spoofed identity`,
      severity: "HIGH",
      confidence: 0.95,
      domain: "Identity",
    }
  }

  const mid = parseInt(mmsi.substring(0, 3))
  if (mid < 200 || mid > 775) {
    return {
      code: "MMSI_INVALID_MID",
      description: `MMSI ${mmsi} has invalid MID ${mid} — unregistered flag state`,
      severity: "HIGH",
      confidence: 0.9,
      domain: "Identity",
    }
  }

  const prefix = mmsi.substring(0, 3)
  if (SANCTIONED_MMSI_PREFIXES.includes(prefix)) {
    return {
      code: "MMSI_SANCTIONED_FLAG",
      description: `MMSI ${mmsi} originates from sanctioned flag state (MID: ${prefix})`,
      severity: "CRITICAL",
      confidence: 0.85,
      domain: "Identity",
    }
  }

  return null
}

// ─── 2. Motion Intelligence ──────────────────────────────────────────────────

function checkSpeedAnomaly(vessel: VesselSnapshot): AnomalyFlag | null {
  if (vessel.speed > 50) {
    return {
      code: "SPEED_IMPOSSIBLE",
      description: `Speed ${vessel.speed.toFixed(1)} kn exceeds physical limit for any vessel — AIS data injection suspected`,
      severity: "CRITICAL",
      confidence: 0.99,
      domain: "Motion",
    }
  }

  if (vessel.speed > 35) {
    return {
      code: "SPEED_EXTREME",
      description: `Speed ${vessel.speed.toFixed(1)} kn is extreme for commercial vessels — verify vessel type`,
      severity: "HIGH",
      confidence: 0.8,
      domain: "Motion",
    }
  }

  const history = vesselHistory.get(vessel.mmsi) || []
  if (vessel.speed === 0 || vessel.speed < 0.3) {
    const stationaryFor = history.filter(h => h.speed < 0.5).length
    if (stationaryFor >= 5) {
      return {
        code: "STATIONARY_OPEN_OCEAN",
        description: `Vessel has been stationary for ${stationaryFor} consecutive readings in open water — possible dark ship activity or disabled vessel`,
        severity: "MEDIUM",
        confidence: 0.7,
        domain: "Motion",
      }
    }
  }

  return null
}

function checkAccelerationAnomaly(vessel: VesselSnapshot): AnomalyFlag | null {
  const history = vesselHistory.get(vessel.mmsi)
  if (!history || history.length < 2) return null
  const prev = history[history.length - 1]
  const timeDeltaSec = ((vessel.timestamp || Date.now()) - (prev.timestamp || Date.now())) / 1000
  if (timeDeltaSec <= 5) return null
  const speedDelta = Math.abs(vessel.speed - prev.speed)
  // Over 15 knots speed change in under 60 seconds is physically impossible for any ship
  if (speedDelta > 15 && timeDeltaSec < 60) {
    return {
      code: "IMPOSSIBLE_ACCELERATION",
      description: `Speed changed by ${speedDelta.toFixed(1)} kn in ${timeDeltaSec.toFixed(0)}s — physically impossible, AIS manipulation suspected`,
      severity: "HIGH",
      confidence: 0.9,
      domain: "Motion",
    }
  }
  return null
}

// ─── 3. GPS / Position Intelligence ─────────────────────────────────────────

function checkPositionJump(vessel: VesselSnapshot): AnomalyFlag | null {
  const history = vesselHistory.get(vessel.mmsi)
  if (!history || history.length < 2) return null

  const prev = history[history.length - 1]
  const timeDeltaSec = ((vessel.timestamp || Date.now()) - (prev.timestamp || Date.now())) / 1000
  if (timeDeltaSec <= 0) return null

  const distKm = haversineKm(prev.lat, prev.lon, vessel.lat, vessel.lon)
  const impliedSpeedKn = (distKm / 1.852) / (timeDeltaSec / 3600)

  if (impliedSpeedKn > vessel.speed + 20 && impliedSpeedKn > 30) {
    return {
      code: "POSITION_JUMP_GPS_SPOOF",
      description: `Position jump of ${distKm.toFixed(1)} km implies ${impliedSpeedKn.toFixed(0)} kn — reported speed is ${vessel.speed.toFixed(1)} kn. GPS spoofing or AIS relay attack suspected.`,
      severity: "HIGH",
      confidence: 0.88,
      domain: "Cyber",
    }
  }

  // Teleportation: >500 km jump in any time window
  if (distKm > 500) {
    return {
      code: "TELEPORTATION_DETECTED",
      description: `Vessel teleported ${distKm.toFixed(0)} km — impossible displacement, likely AIS replay or identity cloning`,
      severity: "CRITICAL",
      confidence: 0.97,
      domain: "Cyber",
    }
  }

  return null
}

// ─── 4. Behaviour Intelligence ───────────────────────────────────────────────

function checkLoitering(vessel: VesselSnapshot): AnomalyFlag | null {
  const history = vesselHistory.get(vessel.mmsi)
  if (!history || history.length < 6) return null

  // Check if last 6 positions are all within 10 km of each other
  const recent = history.slice(-6)
  const centLat = recent.reduce((s, p) => s + p.lat, 0) / recent.length
  const centLon = recent.reduce((s, p) => s + p.lon, 0) / recent.length
  const maxDeviation = Math.max(...recent.map(p => haversineKm(p.lat, p.lon, centLat, centLon)))

  if (maxDeviation < 10 && vessel.speed > 0.5 && vessel.speed < 4) {
    return {
      code: "LOITERING_DETECTED",
      description: `Vessel has been circling a ${maxDeviation.toFixed(1)} km radius area at low speed (${vessel.speed.toFixed(1)} kn) for ${recent.length}+ readings — loitering pattern consistent with rendezvous or illegal transfer`,
      severity: "MEDIUM",
      confidence: 0.72,
      domain: "Behaviour",
    }
  }

  return null
}

function checkAISGap(vessel: VesselSnapshot): AnomalyFlag | null {
  const lastSeen = vesselLastSeen.get(vessel.mmsi)
  if (!lastSeen) return null

  const gapMs = (vessel.timestamp || Date.now()) - lastSeen
  const gapHours = gapMs / (1000 * 60 * 60)

  // AIS gap of more than 4 hours for an underway vessel
  if (gapHours > 4 && vessel.speed > 1) {
    return {
      code: "AIS_TRANSMISSION_GAP",
      description: `Vessel disappeared from AIS for ${gapHours.toFixed(1)} hours then reappeared ${vessel.speed.toFixed(1)} kn underway — possible AIS shutdown to conceal movement (dark ship tactic)`,
      severity: gapHours > 12 ? "HIGH" : "MEDIUM",
      confidence: 0.78,
      domain: "Behaviour",
    }
  }

  return null
}

function checkSuddenStop(vessel: VesselSnapshot): AnomalyFlag | null {
  const history = vesselHistory.get(vessel.mmsi)
  if (!history || history.length < 3) return null

  const recent = history.slice(-3)
  const avgPrevSpeed = recent.slice(0, -1).reduce((s, p) => s + p.speed, 0) / (recent.length - 1)

  if (avgPrevSpeed > 8 && vessel.speed < 0.5) {
    return {
      code: "SUDDEN_STOP",
      description: `Vessel was averaging ${avgPrevSpeed.toFixed(1)} kn and has suddenly stopped — unusual mid-ocean halt may indicate distress, meeting, or equipment tampering`,
      severity: "MEDIUM",
      confidence: 0.65,
      domain: "Behaviour",
    }
  }

  return null
}

function checkCircularPatrol(vessel: VesselSnapshot): AnomalyFlag | null {
  const history = vesselHistory.get(vessel.mmsi)
  if (!history || history.length < 8) return null

  const recent = history.slice(-8)
  // Detect circular pattern: heading changes consistently ~45° per reading
  const headings = recent.map(p => p.heading)
  let totalDelta = 0
  let consistentRotation = 0
  for (let i = 1; i < headings.length; i++) {
    let delta = headings[i] - headings[i - 1]
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    totalDelta += delta
    if (Math.abs(delta) > 20 && Math.abs(delta) < 80) consistentRotation++
  }
  const netRotation = Math.abs(totalDelta)

  if (netRotation > 270 && consistentRotation >= 5) {
    return {
      code: "CIRCULAR_PATROL_PATTERN",
      description: `Vessel has rotated ${netRotation.toFixed(0)}° over last 8 readings with consistent heading changes — circular patrol pattern detected, possible surveillance or illegal fishing`,
      severity: "MEDIUM",
      confidence: 0.68,
      domain: "Behaviour",
    }
  }

  return null
}

// ─── 5. Security Intelligence (Zones) ───────────────────────────────────────

function checkExclusionZones(vessel: VesselSnapshot): AnomalyFlag | null {
  for (const zone of EXCLUSION_ZONES) {
    const [latMin, latMax, lonMin, lonMax] = zone.bounds
    if (
      vessel.lat >= latMin &&
      vessel.lat <= latMax &&
      vessel.lon >= lonMin &&
      vessel.lon <= lonMax
    ) {
      const isHighRisk = zone.name.includes("Piracy") || zone.name.includes("Conflict")
      return {
        code: "RESTRICTED_ZONE_BREACH",
        description: `Vessel operating inside ${zone.name} — ${isHighRisk ? "active threat area" : "restricted navigation zone"}`,
        severity: isHighRisk ? "CRITICAL" : "HIGH",
        confidence: 0.95,
        domain: "Security",
      }
    }
  }
  return null
}

// ─── 6. Cyber / Heading Consistency ─────────────────────────────────────────

function checkHeadingConsistency(vessel: VesselSnapshot): AnomalyFlag | null {
  const history = vesselHistory.get(vessel.mmsi)
  if (!history || history.length < 3) return null

  const recentHeadings = history.slice(-3).map(h => h.heading)
  const headingDeltas = recentHeadings.map((h, i) => {
    if (i === 0) return 0
    let delta = Math.abs(h - recentHeadings[i - 1])
    if (delta > 180) delta = 360 - delta
    return delta
  })

  const avgDelta = headingDeltas.reduce((a, b) => a + b, 0) / headingDeltas.length

  if (avgDelta > 90 && vessel.speed > 5) {
    return {
      code: "ERRATIC_HEADING_AIS_INJECT",
      description: `Average heading change of ${avgDelta.toFixed(0)}° at ${vessel.speed.toFixed(1)} kn — physically impossible maneuver, evasive action or AIS injection suspected`,
      severity: "MEDIUM",
      confidence: 0.65,
      domain: "Cyber",
    }
  }

  return null
}

// ─── Threat Score Aggregator ─────────────────────────────────────────────────

function severityToScore(severity: ThreatLevel): number {
  return { CLEAN: 0, LOW: 10, MEDIUM: 25, HIGH: 50, CRITICAL: 80 }[severity]
}

function aggregateThreatLevel(score: number): ThreatLevel {
  if (score >= 80) return "CRITICAL"
  if (score >= 50) return "HIGH"
  if (score >= 25) return "MEDIUM"
  if (score >= 10) return "LOW"
  return "CLEAN"
}

// ─── Main Evaluation Function ────────────────────────────────────────────────

export function evaluateVesselThreat(vessel: VesselSnapshot): VesselThreatProfile {
  const flags: AnomalyFlag[] = []

  const checks = [
    // Identity
    checkMMSI(vessel.mmsi),
    // Motion
    checkSpeedAnomaly(vessel),
    checkAccelerationAnomaly(vessel),
    // GPS / Cyber
    checkPositionJump(vessel),
    checkHeadingConsistency(vessel),
    // Behaviour
    checkLoitering(vessel),
    checkAISGap(vessel),
    checkSuddenStop(vessel),
    checkCircularPatrol(vessel),
    // Security zones
    checkExclusionZones(vessel),
  ]

  for (const flag of checks) {
    if (flag) flags.push(flag)
  }

  // Record last seen timestamp
  vesselLastSeen.set(vessel.mmsi, vessel.timestamp || Date.now())

  // Update history
  const history = vesselHistory.get(vessel.mmsi) || []
  if (!vesselFirstSeen.has(vessel.mmsi)) {
    vesselFirstSeen.set(vessel.mmsi, vessel.timestamp || Date.now())
  }
  history.push({ ...vessel, timestamp: vessel.timestamp || Date.now() })
  if (history.length > MAX_HISTORY) history.shift()
  vesselHistory.set(vessel.mmsi, history)

  // Calculate composite score
  const score = Math.min(
    100,
    flags.reduce((acc, f) => acc + severityToScore(f.severity) * f.confidence, 0)
  )

  const lastHistory = history[history.length - 2]

  return {
    mmsi: vessel.mmsi,
    threatLevel: aggregateThreatLevel(score),
    score: Math.round(score),
    flags,
    lastEvaluated: Date.now(),
    firstSeen: vesselFirstSeen.get(vessel.mmsi),
    lastKnownLat: lastHistory?.lat,
    lastKnownLon: lastHistory?.lon,
  }
}

// Threat level color mapping for UI
export const THREAT_COLORS: Record<ThreatLevel, string> = {
  CLEAN: "#00ff88",
  LOW: "#88ff00",
  MEDIUM: "#ffcc00",
  HIGH: "#ff6600",
  CRITICAL: "#ff0033",
}

// Domain color mapping
export const DOMAIN_COLORS: Record<string, string> = {
  Identity: "#a78bfa",
  Motion:   "#60a5fa",
  Cyber:    "#f87171",
  Behaviour:"#fbbf24",
  Security: "#fb923c",
  Pattern:  "#34d399",
}
