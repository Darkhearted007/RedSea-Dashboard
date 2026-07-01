import { useEffect, useState } from "react"
import { Link } from "wouter"
import { supabase } from "@/lib/supabase/client"

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
    supabase
      .from("port_intelligence")
      .select("port_code", { count: "exact", head: true })
      .then(({ error }) => {
        setStatus(s => ({ ...s, api: error ? "offline" : "online" }))
      })

    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream")
    const key = import.meta.env.VITE_AISSTREAM_API_KEY

    ws.onopen = () => {
      if (key) {
        ws.send(JSON.stringify({
          APIKey: key,
          BoundingBoxes: [[[0, 0], [1, 1]]],
          FilterMessageTypes: ["PositionReport"],
        }))
        setStatus(s => ({ ...s, ais: "pending" }))
      }
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.MessageType === "PositionReport") {
          setStatus(s => ({ ...s, ais: "online" }))
          setVesselCount(c => c + 1)
          ws.close()
        }
      } catch {}
    }

    ws.onerror = () => setStatus(s => ({ ...s, ais: "offline" }))

    const wsTimeout = setTimeout(() => {
      setStatus(s => ({
        ...s,
        ais: s.ais === "checking" || s.ais === "pending" ? "pending" : s.ais,
      }))
      ws.close()
    }, 8000)

    fetch("/api/health/ai")
      .then(r => r.ok ? r.json() : null)
      .then(data => setStatus(s => ({ ...s, ai: data?.ok ? "online" : "offline" })))
      .catch(() => setStatus(s => ({ ...s, ai: "offline" })))

    return () => { clearTimeout(wsTimeout); ws.readyState === 1 && ws.close() }
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
            ["Supabase API",   status.api],
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
