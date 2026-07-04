import { useEffect, useState } from "react"
import { Link } from "wouter"

type Status = "checking" | "online" | "pending" | "offline"

interface SystemStatus {
  frontend: Status
  api: Status
  ais: Status
  ai: Status
}

const DOT: Record<Status, string> = {
  online:   "text-green-400",
  pending:  "text-yellow-400",
  offline:  "text-red-400",
  checking: "text-gray-500",
}

const LABEL: Record<Status, string> = {
  online:   "● Online",
  pending:  "● Pending",
  offline:  "● Disconnected",
  checking: "● Checking...",
}

export default function HomePage() {
  const [status, setStatus] = useState<SystemStatus>({
    frontend: "online",
    api: "checking",
    ais: "checking",
    ai: "checking",
  })
  const [vesselCount, setVesselCount] = useState(0)

  useEffect(() => {
    // ── API Server health ─────────────────────────────────────────────────────
    fetch("/api/healthz")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setStatus(s => ({ ...s, api: "online" })))
      .catch(() => setStatus(s => ({ ...s, api: "offline" })))

    // ── AI Engine health ──────────────────────────────────────────────────────
    fetch("/api/health/ai")
      .then(r => r.ok ? r.json() : null)
      .then(data => setStatus(s => ({ ...s, ai: data?.ok ? "online" : "offline" })))
      .catch(() => setStatus(s => ({ ...s, ai: "offline" })))

    // ── AIS Stream probe — try server proxy first, fall back to direct ────────
    const proxyUrl = (() => {
      const proto = location.protocol === "https:" ? "wss:" : "ws:"
      return `${proto}//${location.host}/api/ais-stream`
    })()
    const directUrl = "wss://stream.aisstream.io/v0/stream"
    const directKey = import.meta.env.VITE_AISSTREAM_API_KEY as string | undefined

    // How long to wait for the proxy to open before switching to direct (ms)
    const PROXY_CONNECT_TIMEOUT_MS = 4_000
    // Overall AIS probe deadline — settle on "pending" if no vessel received (ms)
    const OVERALL_TIMEOUT_MS = 12_000

    // Bounding boxes covering the main shipping lanes monitored by the platform
    // Format: [[lat_min, lon_min], [lat_max, lon_max]] — matches aisProxy.ts
    const BOUNDING_BOXES = [
      [[ -2,  25], [32,  80]],  // Red Sea / Arabian Sea / Persian Gulf
      [[ -5, -25], [25,  15]],  // West Africa & Gulf of Guinea
      [[ 25, -80], [65,  15]],  // North Atlantic
    ]

    let ws: WebSocket | null = null
    let hasFallenBack = false

    const onMessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(typeof e.data === "string" ? e.data : "")
        if (msg.MessageType === "PositionReport") {
          setStatus(s => ({ ...s, ais: "online" }))
          setVesselCount(c => c + 1)
          clearTimeout(proxyConnectTimeout)
          clearTimeout(wsTimeout)
          ws?.close()
        }
      } catch {}
    }

    const fallbackToDirect = () => {
      if (hasFallenBack) return
      hasFallenBack = true

      // Detach handlers from the proxy socket before discarding it
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      }

      if (!directKey) {
        // No API key available — mark as pending, cannot probe further
        setStatus(s => ({ ...s, ais: "pending" }))
        return
      }

      ws = new WebSocket(directUrl)
      ws.onopen = () => {
        ws!.send(JSON.stringify({
          APIKey: directKey,
          BoundingBoxes: BOUNDING_BOXES,
          FilterMessageTypes: ["PositionReport"],
        }))
        setStatus(s => ({ ...s, ais: "pending" }))
      }
      ws.onmessage = onMessage
      ws.onerror   = () => setStatus(s => ({ ...s, ais: "offline" }))
    }

    // Try proxy first; if it doesn't open within PROXY_CONNECT_TIMEOUT_MS, fall back to direct
    const proxyConnectTimeout = setTimeout(() => {
      if (!hasFallenBack) fallbackToDirect()
    }, PROXY_CONNECT_TIMEOUT_MS)

    ws = new WebSocket(proxyUrl)
    ws.onopen = () => {
      // Proxy handles auth server-side — no key needed from client
      setStatus(s => ({ ...s, ais: "pending" }))
    }
    ws.onmessage = onMessage
    ws.onerror   = () => { clearTimeout(proxyConnectTimeout); fallbackToDirect() }

    // Overall deadline — if no vessel received, settle on pending
    const wsTimeout = setTimeout(() => {
      clearTimeout(proxyConnectTimeout)
      setStatus(s => ({
        ...s,
        ais: s.ais === "checking" || s.ais === "pending" ? "pending" : s.ais,
      }))
      ws?.close()
    }, OVERALL_TIMEOUT_MS)

    return () => {
      clearTimeout(proxyConnectTimeout)
      clearTimeout(wsTimeout)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close()
      }
    }
  }, [])

  const NAV = [
    { href: "/dashboard/overview",  label: "Overview",      icon: "◉" },
    { href: "/dashboard/vessels",   label: "Live Vessels",  icon: "⛵" },
    { href: "/dashboard/ports",     label: "Port Intel",    icon: "⚓" },
    { href: "/dashboard/documents", label: "Documents",     icon: "🔒" },
  ]

  return (
    <div className="min-h-screen bg-[#0b1220] text-white flex flex-col items-center justify-center px-6">
      <div className="text-center">
        <p className="text-xs font-mono text-[#00ffcc] tracking-widest mb-2 uppercase">
          Maritime Intelligence Platform
        </p>
        <h1 className="text-4xl font-bold tracking-wide">RedSea Ledger</h1>
        <p className="mt-3 text-[#4a6080] max-w-md text-sm">
          Real-time AIS tracking, threat detection, port OSINT,
          and blockchain document verification.
        </p>
      </div>

      <div className="mt-10 bg-[#162033] border border-[#1e2d45] rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080] mb-4">
          System Status
        </h2>
        <div className="space-y-3 text-sm">
          {([
            ["Frontend",       status.frontend],
            ["API Server",      status.api],
            ["AIS Stream",     status.ais],
            ["AI Engine",      status.ai],
          ] as [string, Status][]).map(([label, s]) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-[#8a9db0]">{label}</span>
              <span className={`font-mono text-xs ${DOT[s]}`}>
                {LABEL[s]}
              </span>
            </div>
          ))}
        </div>
        {vesselCount > 0 && (
          <div className="mt-4 pt-4 border-t border-[#1e2d45] text-xs text-[#4a6080] font-mono">
            {vesselCount} vessel{vesselCount !== 1 ? "s" : ""} received from AIS feed
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-md">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-[#162033] hover:bg-[#1a2840] border border-[#1e2d45] hover:border-[#00ffcc33] transition-all p-4 rounded-xl text-center group"
          >
            <div className="text-xl mb-1">{item.icon}</div>
            <div className="text-sm font-medium text-[#e2e8f0] group-hover:text-[#00ffcc] transition-colors">
              {item.label}
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-[#2a3d55] font-mono">
        RedSea Ledger · Òsánvault Africa Intelligence Stack
      </p>
    </div>
  )
}
