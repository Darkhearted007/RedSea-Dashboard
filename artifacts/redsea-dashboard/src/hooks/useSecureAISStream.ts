

import { useEffect, useRef } from "react"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { evaluateVesselThreat } from "@/lib/security/aisAnomalyDetector"
import { enrichVesselIntelligence } from "@/lib/intelligence/portIntelligence"
import {
  persistViolation,
  persistThreatProfile,
  persistPosition,
  persistSanctionsHit,
} from "@/lib/supabase/persistence"

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"
const AISSTREAM_API_KEY = import.meta.env.VITE_AISSTREAM_API_KEY || ""
const BOUNDING_BOXES = [[[-90, -180], [90, 180]]]

export const useSecureAISStream = () => {
  const updateVessel = useVesselStore((s) => s.updateVessel)
  const { upsertThreatProfile, upsertIntelligence, addViolation } = useSecurityStore()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!AISSTREAM_API_KEY) {
      console.error("❌ VITE_AISSTREAM_API_KEY missing")
      return
    }

    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      const ws = new WebSocket(AISSTREAM_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("✅ aisstream.io connected")
        ws.send(JSON.stringify({
          APIKey: AISSTREAM_API_KEY,
          BoundingBoxes: BOUNDING_BOXES,
          FilterMessageTypes: ["PositionReport"],
        }))
      }

      ws.onmessage = async (event) => {
        try {
          const raw = JSON.parse(event.data)
          if (raw.MessageType !== "PositionReport") return

          const pos = raw.Message?.PositionReport
          const meta = raw.MetaData
          if (!pos || !meta) return

          const mmsi = String(meta.MMSI || pos.UserID)
          const vessel = {
            mmsi,
            name: meta.ShipName?.trim() || mmsi,
            lat: meta.latitude ?? pos.Latitude,
            lon: meta.longitude ?? pos.Longitude,
            speed: pos.Sog ?? 0,
            heading: pos.TrueHeading !== 511 ? (pos.TrueHeading ?? pos.Cog ?? 0) : (pos.Cog ?? 0),
            timestamp: Date.now(),
          }

          if (vessel.lat === 0 && vessel.lon === 0) return

          // 1. Update in-memory vessel store
          updateVessel(vessel)

          // 2. Threat evaluation
          const threatProfile = evaluateVesselThreat(vessel)
          upsertThreatProfile(threatProfile)

          // 3. Persist threat profile to Supabase (throttled inside persistThreatProfile)
          if (threatProfile.threatLevel !== "CLEAN") {
            persistThreatProfile(threatProfile, vessel.lat, vessel.lon, vessel.speed, vessel.heading, vessel.name)
          }

          // 4. Log HIGH/CRITICAL violations → memory + DB
          for (const flag of threatProfile.flags) {
            if (flag.severity === "HIGH" || flag.severity === "CRITICAL") {
              addViolation({ clientId: mmsi, detail: `[${flag.severity}] ${flag.code}: ${flag.description}`, timestamp: Date.now() })
              persistViolation(mmsi, flag, threatProfile.score, vessel.lat, vessel.lon)
            }
          }

          // 5. Intelligence enrichment + sanctions persistence
          const intel = enrichVesselIntelligence(mmsi, vessel.name)
          upsertIntelligence(intel)

          for (const hit of intel.sanctionHits) {
            persistSanctionsHit(mmsi, vessel.name, hit)
          }

          // 6. Position history (throttled to 1/min per vessel inside persistPosition)
          persistPosition({ mmsi, lat: vessel.lat, lon: vessel.lon, speed: vessel.speed, heading: vessel.heading })

        } catch (err) {
          console.error("❌ AIS parse error:", err)
        }
      }

      ws.onerror = (err) => console.error("❌ AIS WebSocket error:", err)
      ws.onclose = (e) => {
        console.warn(`⚠️ AIS stream closed (${e.code}) — reconnecting in 5s`)
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => { clearTimeout(reconnectTimeout); wsRef.current?.close() }
  }, [updateVessel, upsertThreatProfile, upsertIntelligence, addViolation])
}
