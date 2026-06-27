"use client"

import { useEffect, useRef } from "react"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { evaluateVesselThreat } from "@/lib/security/aisAnomalyDetector"
import { enrichVesselIntelligence } from "@/lib/intelligence/portIntelligence"

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"
const AISSTREAM_API_KEY = process.env.NEXT_PUBLIC_AISSTREAM_API_KEY || ""

// Bounding boxes: full global coverage — tighten for performance
// Format: [[lat_sw, lon_sw], [lat_ne, lon_ne]]
const BOUNDING_BOXES = [[[-90, -180], [90, 180]]]

/**
 * Real-time AIS stream from aisstream.io
 * Message format: { MessageType, Message: { PositionReport: { ... } }, MetaData: { MMSI, ShipName, latitude, longitude, ... } }
 * Mapped → internal vessel format → threat evaluation → intelligence enrichment
 */
export const useSecureAISStream = () => {
  const updateVessel = useVesselStore((s) => s.updateVessel)
  const { upsertThreatProfile, upsertIntelligence, addViolation } = useSecurityStore()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!AISSTREAM_API_KEY) {
      console.error("❌ NEXT_PUBLIC_AISSTREAM_API_KEY missing — no live AIS data")
      return
    }

    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      const ws = new WebSocket(AISSTREAM_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("✅ aisstream.io connected")
        // Send subscription immediately — connection closes if not sent within 3s
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

          // Map aisstream.io fields → internal vessel shape
          const vessel = {
            mmsi,
            name: meta.ShipName?.trim() || mmsi,
            lat: meta.latitude ?? pos.Latitude,
            lon: meta.longitude ?? pos.Longitude,
            speed: pos.Sog ?? 0,
            heading: pos.TrueHeading !== 511 ? (pos.TrueHeading ?? pos.Cog ?? 0) : (pos.Cog ?? 0),
            timestamp: Date.now(),
          }

          // Skip invalid positions
          if (vessel.lat === 0 && vessel.lon === 0) return

          // 1. Update vessel store
          updateVessel(vessel)

          // 2. Threat evaluation
          const threatProfile = evaluateVesselThreat(vessel)
          upsertThreatProfile(threatProfile)

          // 3. Log HIGH/CRITICAL flags
          for (const flag of threatProfile.flags) {
            if (flag.severity === "HIGH" || flag.severity === "CRITICAL") {
              addViolation({
                clientId: mmsi,
                detail: `[${flag.severity}] ${flag.code}: ${flag.description}`,
                timestamp: Date.now(),
              })
            }
          }

          // 4. Intelligence enrichment
          const intel = enrichVesselIntelligence(mmsi, vessel.name)
          upsertIntelligence(intel)

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

    return () => {
      clearTimeout(reconnectTimeout)
      wsRef.current?.close()
    }
  }, [updateVessel, upsertThreatProfile, upsertIntelligence, addViolation])
}
