import { useState, useEffect, useMemo } from "react"
import AISMap from "@/components/maps/AISMap"
import { useSecureAISStream } from "@/hooks/useSecureAISStream"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"
import { countryToFlag } from "@/lib/ais/midCodes"

// ── Cargo type descriptions from AIS vessel-type codes ────────────────────────
function cargoDescription(vesselType?: string, typeCode?: number): { label: string; detail: string } {
  if (vesselType === "TANKER") {
    const sub = typeCode ? typeCode - 80 : -1
    const subtypes: Record<number, string> = {
      0: "tanker (unspecified)", 1: "hazardous cat A", 2: "hazardous cat B",
      3: "hazardous cat C", 4: "hazardous cat D", 9: "tanker (no cargo info)",
    }
    return {
      label: "TANKER",
      detail: subtypes[sub] ?? "Liquid bulk — petroleum, chemicals, or LNG/LPG",
    }
  }
  if (vesselType === "CARGO") {
    const sub = typeCode ? typeCode - 70 : -1
    const subtypes: Record<number, string> = {
      1: "hazardous cat A", 2: "hazardous cat B",
      3: "hazardous cat C", 4: "hazardous cat D",
    }
    return {
      label: "CARGO",
      detail: subtypes[sub] ?? "Dry bulk, containers, or general freight",
    }
  }
  if (vesselType === "PASSENGER") return { label: "PASSENGER", detail: "Passenger transport — no commercial cargo" }
  if (vesselType === "FISHING")   return { label: "FISHING",   detail: "Commercial fishing — variable catch cargo" }
  if (vesselType === "MILITARY")  return { label: "MILITARY",  detail: "Naval or coast guard vessel" }
  if (vesselType === "TUG")       return { label: "TUG",       detail: "Towing & port assistance — no cargo" }
  if (vesselType === "SAR")       return { label: "SAR",       detail: "Search & rescue — emergency services" }
  if (vesselType === "SAILING")   return { label: "SAILING",   detail: "Sailing vessel — recreational or racing" }
  return { label: "UNKNOWN", detail: "Vessel type not yet received from AIS feed" }
}

// ── Risk color helper ─────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ff0033", HIGH: "#ff6600", MEDIUM: "#ffcc00", LOW: "#00ff88", CLEAN: "#00ffcc",
}

// ── Intel panel ───────────────────────────────────────────────────────────────
function IntelPanel({ mmsi, onClose }: { mmsi: string; onClose: () => void }) {
  const vessel    = useVesselStore((s) => s.vessels[mmsi])
  const profile   = useSecurityStore((s) => s.threatProfiles[mmsi])
  const intel     = useSecurityStore((s) => s.intelligence[mmsi])
  const [track, setTrack] = useState<{ lat: string; lon: string; recorded_at: string }[]>([])
  const [trackLoading, setTrackLoading] = useState(false)

  // Fetch DB historical track once on open
  useEffect(() => {
    setTrackLoading(true)
    fetch(`/api/vessels/${encodeURIComponent(mmsi)}/track?hours=72`)
      .then((r) => r.json())
      .then((data) => { setTrack(Array.isArray(data) ? data : []); setTrackLoading(false) })
      .catch(() => setTrackLoading(false))
  }, [mmsi])

  if (!vessel) return null

  const threatLevel  = profile?.threatLevel ?? "CLEAN"
  const threatColor  = THREAT_COLORS[threatLevel]
  const score        = profile?.score ?? 0
  const flags        = profile?.flags ?? []
  const cargo        = cargoDescription(vessel.vesselType, vessel.typeCode)
  const flag         = countryToFlag(vessel.flagState ?? "")

  const draughtPercent = vessel.draught ? Math.min(100, (vessel.draught / 22) * 100) : null

  return (
    <div className="h-full flex flex-col bg-[#0b1220] border-l border-[#1e2d45] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[#1e2d45]">
        <div className="flex-1 min-w-0">
          <div
            className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded mb-2"
            style={{ color: threatColor, background: threatColor + "18", border: `1px solid ${threatColor}44` }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: threatColor, display: "inline-block" }} />
            {threatLevel}
          </div>
          <h2 className="text-base font-bold text-[#e2e8f0] truncate">
            {vessel.name || `MMSI ${mmsi}`}
          </h2>
          <p className="text-xs text-[#4a6080] font-mono mt-0.5">
            {flag} {vessel.flagState || "Unknown flag"} · MMSI {mmsi}
          </p>
        </div>
        <button onClick={onClose} className="ml-2 text-[#4a6080] hover:text-[#e2e8f0] text-lg leading-none mt-1">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs">

        {/* Navigation */}
        <Section title="Navigation">
          <Row label="Speed"       value={`${Number(vessel.speed).toFixed(1)} knots`} />
          <Row label="Heading"     value={`${Number(vessel.heading).toFixed(0)}°`} />
          {vessel.destination && <Row label="Destination" value={vessel.destination} highlight />}
          <Row label="Position"    value={`${vessel.lat.toFixed(4)}°N, ${vessel.lon.toFixed(4)}°E`} />
          {vessel.callSign  && <Row label="Call sign"   value={vessel.callSign} />}
          {vessel.imoNumber && <Row label="IMO"         value={vessel.imoNumber} />}
        </Section>

        {/* Cargo Intelligence */}
        <Section title="Cargo Intelligence">
          <div
            className="rounded-lg p-3 mb-1"
            style={{ background: "#162033", border: "1px solid #1e2d45" }}
          >
            <p className="text-[10px] tracking-widest uppercase text-[#4a6080] mb-1">Vessel Class</p>
            <p className="font-bold text-[#00ffcc]">{cargo.label}</p>
            <p className="text-[#8a9db0] mt-1 leading-relaxed">{cargo.detail}</p>
          </div>
          {draughtPercent !== null && (
            <div className="mt-2">
              <p className="text-[#4a6080] mb-1">Draught — {vessel.draught}m (cargo load proxy)</p>
              <div className="h-1.5 rounded-full bg-[#1e2d45]">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${draughtPercent}%`, background: draughtPercent > 70 ? "#ff6600" : "#00ffcc" }}
                />
              </div>
              <p className="text-[#4a6080] mt-1">{draughtPercent.toFixed(0)}% of max draught</p>
            </div>
          )}
        </Section>

        {/* Threat Assessment */}
        <Section title={`Threat Assessment — ${score}/100`}>
          {/* Score bar */}
          <div className="h-1.5 rounded-full bg-[#1e2d45] mb-3">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${score}%`, background: threatColor }}
            />
          </div>

          {flags.length === 0 ? (
            <p className="text-[#4a6080]">No anomalies detected</p>
          ) : (
            <div className="space-y-2">
              {flags.map((f, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: "#162033", border: `1px solid ${RISK_COLORS[f.severity] ?? "#1e2d45"}33` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: RISK_COLORS[f.severity], background: (RISK_COLORS[f.severity] ?? "#4a6080") + "22" }}
                    >
                      {f.severity}
                    </span>
                    <span className="font-mono text-[#e2e8f0]">{f.code}</span>
                  </div>
                  <p className="text-[#8a9db0] leading-relaxed">{f.description}</p>
                  <p className="text-[#4a6080] mt-1">Confidence: {((f.confidence ?? 1) * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Sanctions & Intelligence */}
        {intel && (
          <Section title="Sanctions Screening">
            {intel.sanctionHits.length === 0 ? (
              <p className="text-[#00ff88]">✓ No sanction matches</p>
            ) : (
              <div className="space-y-2">
                {intel.sanctionHits.map((h, i) => (
                  <div key={i} className="rounded-lg p-2.5 border border-[#ff003344] bg-[#ff003312]">
                    <p className="text-[#ff4466] font-mono">{h.regime} — {h.listName}</p>
                    <p className="text-[#8a9db0] mt-0.5">Match: {h.matchType} · {(h.confidence * 100).toFixed(0)}% confidence</p>
                    {h.reference && <p className="text-[#4a6080] mt-0.5">Ref: {h.reference}</p>}
                  </div>
                ))}
              </div>
            )}
            {intel.riskIndicators.length > 0 && (
              <div className="mt-2 space-y-1">
                {intel.riskIndicators.map((r, i) => (
                  <p key={i} className="text-[#ffcc00]">⚠ {r}</p>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Vessel History */}
        <Section title="Position History (72 h)">
          {trackLoading ? (
            <p className="text-[#4a6080]">Fetching from database…</p>
          ) : track.length === 0 ? (
            <p className="text-[#4a6080]">No recorded positions yet — live positions accumulate as vessel transmits</p>
          ) : (
            <>
              <p className="text-[#00ffcc] mb-2">{track.length} recorded positions</p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {[...track].reverse().slice(0, 20).map((pt, i) => (
                  <div key={i} className="flex justify-between text-[#4a6080] font-mono py-0.5 border-b border-[#1e2d4522]">
                    <span>{parseFloat(pt.lat).toFixed(3)}°, {parseFloat(pt.lon).toFixed(3)}°</span>
                    <span>{new Date(pt.recorded_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
              <p className="text-[#2a3d55] mt-1">Showing 20 most recent of {track.length}</p>
            </>
          )}
          <p className="mt-2 text-[#2a3d55]">
            Live trail: {vessel.path.length} pts in memory
          </p>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-mono tracking-widest uppercase text-[#4a6080] mb-2">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#1e2d4544]">
      <span className="text-[#4a6080]">{label}</span>
      <span className={highlight ? "text-[#00ffcc] font-mono" : "text-[#8a9db0] font-mono"}>{value}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VesselsPage() {
  useSecureAISStream()

  const vessels = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()
  const [selectedMmsi, setSelectedMmsi] = useState<string | null>(null)

  const stats = useMemo(() => {
    const profiles = Object.values(threatProfiles)
    return {
      total: Object.keys(vessels).length,
      critical: profiles.filter((p) => p.threatLevel === "CRITICAL").length,
      high: profiles.filter((p) => p.threatLevel === "HIGH").length,
    }
  }, [vessels, threatProfiles])

  const handleSelect = (mmsi: string) => {
    setSelectedMmsi((prev) => (prev === mmsi ? null : mmsi))
  }

  return (
    <div className="flex w-full h-screen bg-[#0b1220] overflow-hidden">
      {/* Map — shrinks when panel is open */}
      <div className="relative flex-1 min-w-0 h-full">
        {/* Stat chips */}
        <div className="absolute top-4 left-4 flex gap-2 z-[1000]">
          {[
            { label: "VESSELS",  value: stats.total,    color: "#00ffcc" },
            { label: "CRITICAL", value: stats.critical, color: THREAT_COLORS.CRITICAL },
            { label: "HIGH",     value: stats.high,     color: THREAT_COLORS.HIGH },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg px-3 py-1.5 text-center"
              style={{ backgroundColor: "#162033cc", border: `1px solid ${s.color}33` }}
            >
              <p className="text-[10px] font-mono" style={{ color: s.color }}>{s.label}</p>
              <p className="text-lg font-bold font-mono leading-tight" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {selectedMmsi && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] text-xs font-mono text-[#00ffcc] bg-[#162033cc] border border-[#00ffcc33] rounded-lg px-3 py-1.5 backdrop-blur-sm"
          >
            ◉ Tracking {vessels[selectedMmsi]?.name || selectedMmsi} — trail active
          </div>
        )}

        <AISMap selectedMmsi={selectedMmsi} onSelectVessel={handleSelect} />
      </div>

      {/* Intelligence panel */}
      {selectedMmsi && (
        <div className="w-80 shrink-0 h-full overflow-hidden">
          <IntelPanel mmsi={selectedMmsi} onClose={() => setSelectedMmsi(null)} />
        </div>
      )}
    </div>
  )
}
