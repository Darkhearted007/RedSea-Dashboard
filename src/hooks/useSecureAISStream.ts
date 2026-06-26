"use client"

import { useEffect } from "react"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { evaluateVesselThreat } from "@/lib/security/aisAnomalyDetector"
import { enrichVesselIntelligence } from "@/lib/intelligence/portIntelligence"

/**
 * Security-hardened AIS stream hook
 * Wraps the raw WebSocket stream with:
 * 1. Threat evaluation on every vessel update
 * 2. Intelligence enrichment (sanctions, port risk)
 * 3. Violation logging for the security audit panel
 */
export const useSecureAISStream = () => {
  const updateVessel = useVesselStore((s) => s.updateVessel)
  const { upsertThreatProfile, upsertIntelligence, addViolation } = useSecurityStore()

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL
    if (!url) {
      console.error("❌ NEXT_PUBLIC_WS_URL missing")
      return
    }

    const ws = new WebSocket(url)

    ws.onopen = () => {
      console.log("✅ Secure AIS WebSocket connected")
    }

    ws.onmessage = async (event) => {
      try {
        const raw = JSON.parse(event.data)
        const vessels = Array.isArray(raw) ? raw : [raw]

        for (const v of vessels) {
          // 1. Update base vessel store
          updateVessel(v)

          // 2. Run threat evaluation
          const threatProfile = evaluateVesselThreat(v)
          upsertThreatProfile(threatProfile)

          // 3. Log any HIGH/CRITICAL flags as violations
          const severeFlags = threatProfile.flags.filter(
            (f) => f.severity === "HIGH" || f.severity === "CRITICAL"
          )
          for (const flag of severeFlags) {
            addViolation({
              clientId: v.mmsi,
              detail: `[${flag.severity}] ${flag.code}: ${flag.description}`,
              timestamp: Date.now(),
            })
          }

          // 4. Intelligence enrichment (async, non-blocking)
          const intel = enrichVesselIntelligence(v.mmsi)
          upsertIntelligence(intel)
        }
      } catch (err) {
        console.error("❌ Secure AIS parse error:", err)
      }
    }

    ws.onerror = (err) => console.error("❌ AIS WebSocket error:", err)
    ws.onclose = () => console.warn("⚠️ AIS WebSocket closed")

    return () => ws.close()
  }, [updateVessel, upsertThreatProfile, upsertIntelligence, addViolation])
}
