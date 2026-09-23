import { useEffect, useRef } from "react"
import { useVesselStore } from "@/stores/vesselStore"

const PROXY_URL = (() => {
  const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss:" : "ws:"
  return typeof location !== "undefined"
    ? `${proto}//${location.host}/api/ais-stream`
    : ""
})()

export const useSecureAISStream = () => {
  const updateVessel = useVesselStore((s) => s.updateVessel)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!PROXY_URL) return

    const ws = new WebSocket(PROXY_URL)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(typeof event.data === "string" ? event.data : "")
        if (message?.MessageType === "PositionReport") {
          updateVessel(message)
        }
      } catch {
        // Ignore malformed provider messages at the UI boundary.
      }
    }

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null
    }

    ws.onerror = () => {
      ws.close()
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      if (wsRef.current === ws) wsRef.current = null
    }
  }, [updateVessel])
}
