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
  fetchAllVesselProfiles,
} from "@/lib/supabase/persistence"
import { mmsiToCountry, vesselTypeLabel } from "@/lib/ais/midCodes"

const PROXY_URL = (() => {
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/api/ais-stream`
})()

const DIRECT_URL = "wss://stream.aisstream.io/v0/stream"
const DIRECT_API_KEY = import.meta.env.VITE_AISSTREAM_API_KEY || ""

export const useSecureAISStream = () => {
  const updateVessel = useVesselStore((s) => s.updateVessel)
  const updateVesselStatic = useVesselStore((s) => s.updateVesselStatic)
  const setVessels = useVesselStore((s) => s.setVessels)
  const { upsertThreatProfile, upsertIntelligence, addViolation } = useSecurityStore()
  const wsRef = useRef<WebSocket | null>(null)

  // ── Hydrate from Supabase on mount ────────────────────────────────────────
  useEffect(() => {
    fetchAllVesselProfiles().then((rows) => {
      if (!rows.length) return
      // Populate vessel store with seeded/persisted positions
      setVessels(rows.map((r: any) => ({
        mmsi:     r.mmsi,
        name:     r.vessel_name || r.mmsi,
        lat:      r.last_lat  ?? 0,
        lon:      r.last_lon  ?? 0,
        speed:    r.last_speed   ?? 0,
        heading:  r.last_heading ?? 0,
        flagState: mmsiToCountry(r.mmsi),
      })))
      // Populate threat profiles
      for (const r of rows) {
        upsertThreatProfile({
          mmsi:        r.mmsi,
          threatLevel: r.threat_level ?? "CLEAN",
          score:       r.score ?? 0,
          flags:       r.flags ?? [],
        })
      }
      console.log(`✅ Hydrated ${rows.length} vessels from Supabase`)
    }).catch((err: unknown) => console.warn("⚠️ Supabase hydration failed:", err))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>
    let useProxy = true

    const connect = () => {
      const url = useProxy ? PROXY_URL : DIRECT_URL
      const ws = new WebSocket(url)
      wsRef.current = ws

      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn("⚠️ Proxy timeout — falling back to direct AIS stream")
          ws.close()
          useProxy = false
        }
      }, 4000)

      ws.onopen = () => {
        clearTimeout(connectTimeout)
        console.log(`✅ AIS stream connected (${useProxy ? "proxy" : "direct"})`)
        if (!useProxy) {
          ws.send(JSON.stringify({
            APIKey: DIRECT_API_KEY,
            BoundingBoxes: [[[-90, -180], [90, 180]]],
            FilterMessageTypes: ["PositionReport", "ShipStaticData"],
          }))
        }
      }

      ws.onmessage = async (event) => {
        try {
          const text = event.data instanceof Blob
            ? await event.data.text()
            : event.data
          const raw = JSON.parse(text)

          const messageType: string = raw.MessageType
          const meta = raw.MetaData
          if (!meta) return

          const mmsi = String(meta.MMSI)

          if (messageType === "ShipStaticData") {
            const s = raw.Message?.ShipStaticData
            if (!s) return
            const typeCode = Number(s.TypeOfShipAndCargoType ?? 0)
            const flagState = mmsiToCountry(mmsi)
            updateVesselStatic(mmsi, {
              name: s.Name?.trim() || undefined,
              vesselType: vesselTypeLabel(typeCode),
              flagState,
              destination: s.Destination?.trim() || undefined,
            })
            return
          }

          if (messageType !== "PositionReport") return

          const pos = raw.Message?.PositionReport
          if (!pos) return

          const vessel = {
            mmsi,
            name: meta.ShipName?.trim() || mmsi,
            lat: meta.latitude ?? pos.Latitude,
            lon: meta.longitude ?? pos.Longitude,
            speed: pos.Sog ?? 0,
            heading: pos.TrueHeading !== 511 ? (pos.TrueHeading ?? pos.Cog ?? 0) : (pos.Cog ?? 0),
            timestamp: Date.now(),
            flagState: mmsiToCountry(mmsi),
          }

          if (vessel.lat === 0 && vessel.lon === 0) return

          updateVessel(vessel)

          const threatProfile = evaluateVesselThreat(vessel)
          upsertThreatProfile(threatProfile)

          if (threatProfile.threatLevel !== "CLEAN") {
            persistThreatProfile(threatProfile, vessel.lat, vessel.lon, vessel.speed, vessel.heading, vessel.name)
          }

          for (const flag of threatProfile.flags) {
            if (flag.severity === "HIGH" || flag.severity === "CRITICAL") {
              addViolation({ clientId: mmsi, detail: `[${flag.severity}] ${flag.code}: ${flag.description}`, timestamp: Date.now() })
              persistViolation(mmsi, flag, threatProfile.score, vessel.lat, vessel.lon)
            }
          }

          const intel = enrichVesselIntelligence(mmsi, vessel.name)
          upsertIntelligence(intel)

          for (const hit of intel.sanctionHits) {
            persistSanctionsHit(mmsi, vessel.name, hit)
          }

          persistPosition({ mmsi, lat: vessel.lat, lon: vessel.lon, speed: vessel.speed, heading: vessel.heading })

        } catch (err) {
          console.error("❌ AIS parse error:", err)
        }
      }

      ws.onerror = () => {
        if (useProxy) {
          console.warn("⚠️ AIS proxy error — will retry direct")
          useProxy = false
        }
      }
      ws.onclose = (e) => {
        console.warn(`⚠️ AIS stream closed (${e.code}) — reconnecting in 5s`)
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => { clearTimeout(reconnectTimeout); wsRef.current?.close() }
  }, [updateVessel, updateVesselStatic, upsertThreatProfile, upsertIntelligence, addViolation])
}
