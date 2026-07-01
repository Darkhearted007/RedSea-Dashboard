"use client"

import { useEffect } from "react"
import { useVesselStore } from "@/store/useVesselStore"

export const useAISStream = () => {
  const updateVessel = useVesselStore((s) => s.updateVessel)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL

    if (!url) {
      console.error("❌ NEXT_PUBLIC_WS_URL missing")
      return
    }

    const ws = new WebSocket(url)

    ws.onopen = () => {
      console.log("✅ AIS WebSocket connected")
    }

    ws.onmessage = (event) => {
      try {
        const vessels = JSON.parse(event.data)

        for (const v of vessels) {
          updateVessel(v)
        }
      } catch (err) {
        console.error("❌ AIS parse error:", err)
      }
    }

    ws.onerror = (err) => {
      console.error("❌ AIS WebSocket error:", err)
    }

    ws.onclose = () => {
      console.warn("⚠️ AIS WebSocket closed")
    }

    return () => ws.close()
  }, [updateVessel])
}
