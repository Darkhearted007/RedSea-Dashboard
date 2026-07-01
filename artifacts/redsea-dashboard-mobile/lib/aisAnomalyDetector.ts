export type ThreatLevel = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface AnomalyFlag {
  code: string
  description: string
  severity: ThreatLevel
  confidence: number
}

export interface VesselThreatProfile {
  mmsi: string
  threatLevel: ThreatLevel
  score: number
  flags: AnomalyFlag[]
  lastEvaluated: number
}

interface VesselSnapshot {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
  timestamp?: number
}

const vesselHistory = new Map<string, VesselSnapshot[]>()
const MAX_HISTORY = 10

const SANCTIONED_MMSI_PREFIXES = ["567", "432", "999"]

const EXCLUSION_ZONES = [
  { name: "Strait of Hormuz Restricted", bounds: [25.5, 27.5, 55.5, 57.5] },
  { name: "Gulf of Aden Piracy Zone", bounds: [11.0, 15.0, 43.0, 55.0] },
]

function checkMMSI(mmsi: string): AnomalyFlag | null {
  if (!/^\d{9}$/.test(mmsi)) {
    return {
      code: "MMSI_INVALID_FORMAT",
      description: `MMSI ${mmsi} fails 9-digit format check — possible spoofed identity`,
      severity: "HIGH",
      confidence: 0.95,
    }
  }
  const mid = parseInt(mmsi.substring(0, 3))
  if (mid < 200 || mid > 775) {
    return {
      code: "MMSI_INVALID_MID",
      description: `MMSI ${mmsi} has invalid MID ${mid} — unregistered flag state`,
      severity: "HIGH",
      confidence: 0.9,
    }
  }
  const prefix = mmsi.substring(0, 3)
  if (SANCTIONED_MMSI_PREFIXES.includes(prefix)) {
    return {
      code: "MMSI_SANCTIONED_FLAG",
      description: `MMSI ${mmsi} originates from sanctioned flag state (MID: ${prefix})`,
      severity: "CRITICAL",
      confidence: 0.85,
    }
  }
  return null
}

function checkSpeedAnomaly(vessel: VesselSnapshot): AnomalyFlag | null {
  if (vessel.speed > 50) {
    return {
      code: "SPEED_IMPOSSIBLE",
      description: `Speed ${vessel.speed.toFixed(1)} kn exceeds physical limit — AIS data injection suspected`,
      severity: "CRITICAL",
      confidence: 0.99,
    }
  }
  if (vessel.speed === 0) {
    const history = vesselHistory.get(vessel.mmsi) || []
    const stationaryFor = history.filter(h => h.speed < 0.5).length
    if (stationaryFor >= 5) {
      return {
        code: "STATIONARY_OPEN_OCEAN",
        description: `Vessel stationary for ${stationaryFor} consecutive readings in open ocean — possible dark ship activity`,
        severity: "MEDIUM",
        confidence: 0.7,
      }
    }
  }
  return null
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
      code: "POSITION_JUMP_DETECTED",
      description: `Position jump of ${distKm.toFixed(1)} km implies ${impliedSpeedKn.toFixed(0)} kn — reported speed is ${vessel.speed.toFixed(1)} kn. GPS spoofing suspected.`,
      severity: "HIGH",
      confidence: 0.88,
    }
  }
  return null
}

function checkExclusionZones(vessel: VesselSnapshot): AnomalyFlag | null {
  for (const zone of EXCLUSION_ZONES) {
    const [latMin, latMax, lonMin, lonMax] = zone.bounds
    if (vessel.lat >= latMin && vessel.lat <= latMax && vessel.lon >= lonMin && vessel.lon <= lonMax) {
      return {
        code: "EXCLUSION_ZONE_BREACH",
        description: `Vessel detected inside ${zone.name}`,
        severity: "HIGH",
        confidence: 0.95,
      }
    }
  }
  return null
}

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
      code: "ERRATIC_HEADING",
      description: `Average heading change of ${avgDelta.toFixed(0)}° at ${vessel.speed.toFixed(1)} kn — evasive maneuvers or spoofed AIS`,
      severity: "MEDIUM",
      confidence: 0.65,
    }
  }
  return null
}

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

export function evaluateVesselThreat(vessel: { mmsi: string; lat: number; lon: number; speed: number; heading: number; timestamp?: number }): VesselThreatProfile {
  const flags: AnomalyFlag[] = []
  const checks = [
    checkMMSI(vessel.mmsi),
    checkSpeedAnomaly(vessel),
    checkPositionJump(vessel),
    checkExclusionZones(vessel),
    checkHeadingConsistency(vessel),
  ]
  for (const flag of checks) {
    if (flag) flags.push(flag)
  }
  const history = vesselHistory.get(vessel.mmsi) || []
  history.push({ ...vessel, timestamp: vessel.timestamp || Date.now() })
  if (history.length > MAX_HISTORY) history.shift()
  vesselHistory.set(vessel.mmsi, history)
  const score = Math.min(
    100,
    flags.reduce((acc, f) => acc + severityToScore(f.severity) * f.confidence, 0)
  )
  return {
    mmsi: vessel.mmsi,
    threatLevel: aggregateThreatLevel(score),
    score: Math.round(score),
    flags,
    lastEvaluated: Date.now(),
  }
}

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  CLEAN: "#00ff88",
  LOW: "#88ff00",
  MEDIUM: "#ffcc00",
  HIGH: "#ff6600",
  CRITICAL: "#ff0033",
}
