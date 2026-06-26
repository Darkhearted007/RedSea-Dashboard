"use client"

import { useState, useMemo } from "react"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import {
  resolvePortProfile,
  enrichVesselIntelligence,
  buildIntelligenceSummary,
  detectRouteAnomalies,
} from "@/lib/intelligence/portIntelligence"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"

const RISK_COLORS = {
  LOW: "#00ff88",
  MEDIUM: "#ffcc00",
  HIGH: "#ff6600",
  CRITICAL: "#ff0033",
}

const KNOWN_PORTS = ["NGLAG", "GHTEM", "KETIZ", "ZADUR", "IRBAN", "SYJDH"]

export default function PortsPage() {
  const [selectedPort, setSelectedPort] = useState<string | null>(null)
  const [selectedMMSI, setSelectedMMSI] = useState("")
  const vessels = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()

  const portProfile = useMemo(
    () => (selectedPort ? resolvePortProfile(selectedPort) : null),
    [selectedPort]
  )

  const vesselIntel = useMemo(() => {
    if (!selectedMMSI) return null
    const intel = enrichVesselIntelligence(selectedMMSI, undefined, [
      "NGLAG",
      "IRBAN",
      "SYJDH",
    ])
    return intel
  }, [selectedMMSI])

  const intelSummary = useMemo(() => {
    if (!vesselIntel) return null
    const anomalies = detectRouteAnomalies([])
    return buildIntelligenceSummary(vesselIntel, anomalies)
  }, [vesselIntel])

  const trackedVesselList = useMemo(() => Object.values(vessels).slice(0, 20), [vessels])

  return (
    <div className="p-6 space-y-6 text-[#e2e8f0] min-h-screen bg-[#0b1220]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Port Intelligence</h1>
        <p className="text-sm text-[#4a6080] mt-1">
          OSINT enrichment, sanctions screening, and port risk profiles
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Port risk profiles */}
        <div className="bg-[#162033] rounded-xl border border-[#1e2d45]">
          <div className="px-5 py-4 border-b border-[#1e2d45]">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080]">
              Port Risk Database
            </h2>
          </div>
          <div className="divide-y divide-[#1e2d45]">
            {KNOWN_PORTS.map((code) => {
              const p = resolvePortProfile(code)
              return (
                <button
                  key={code}
                  onClick={() => setSelectedPort(code)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-[#1a2840] transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-[#4a6080]">{p.country} · {code}</p>
                  </div>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{
                      color: RISK_COLORS[p.riskLevel],
                      backgroundColor: RISK_COLORS[p.riskLevel] + "22",
                      border: `1px solid ${RISK_COLORS[p.riskLevel]}44`,
                    }}
                  >
                    {p.riskLevel}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Port detail panel */}
        <div className="bg-[#162033] rounded-xl border border-[#1e2d45]">
          <div className="px-5 py-4 border-b border-[#1e2d45]">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080]">
              {portProfile ? portProfile.name : "Select a port"}
            </h2>
          </div>
          {portProfile ? (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["UN/LOCODE", portProfile.portCode],
                  ["Country", portProfile.country],
                  ["Coordinates", `${portProfile.lat.toFixed(2)}, ${portProfile.lon.toFixed(2)}`],
                  ["Congestion", portProfile.congestionLevel || "N/A"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[#0b1220] rounded-lg p-3">
                    <p className="text-xs text-[#4a6080] mb-1">{label}</p>
                    <p className="text-xs font-mono">{value}</p>
                  </div>
                ))}
              </div>

              {portProfile.sanctions.length > 0 && (
                <div className="bg-[#ff003310] border border-[#ff003333] rounded-lg p-4">
                  <p className="text-xs font-bold text-[#ff0033] mb-2">
                    ⚠ SANCTIONS ACTIVE
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {portProfile.sanctions.map((s) => (
                      <span
                        key={s}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-[#ff003322] text-[#ff6666]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {portProfile.notes.length > 0 && (
                <div>
                  <p className="text-xs text-[#4a6080] uppercase tracking-widest mb-2">
                    Intelligence Notes
                  </p>
                  <ul className="space-y-1">
                    {portProfile.notes.map((note, i) => (
                      <li key={i} className="text-xs text-[#8a9db0] flex gap-2">
                        <span className="text-[#4a6080]">›</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-[#4a6080] text-sm">
              Select a port to view intelligence profile
            </div>
          )}
        </div>
      </div>

      {/* Vessel sanctions screening */}
      <div className="bg-[#162033] rounded-xl border border-[#1e2d45]">
        <div className="px-5 py-4 border-b border-[#1e2d45]">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080]">
            Vessel Sanctions Screening
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <select
              className="flex-1 bg-[#0b1220] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] font-mono"
              value={selectedMMSI}
              onChange={(e) => setSelectedMMSI(e.target.value)}
            >
              <option value="">Select tracked vessel...</option>
              {trackedVesselList.map((v) => (
                <option key={v.mmsi} value={v.mmsi}>
                  MMSI: {v.mmsi}
                </option>
              ))}
            </select>
            {/* Manual MMSI entry */}
            <input
              type="text"
              placeholder="Or enter MMSI..."
              className="w-40 bg-[#0b1220] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm font-mono text-[#e2e8f0]"
              onChange={(e) => {
                if (e.target.value.length === 9) setSelectedMMSI(e.target.value)
              }}
            />
          </div>

          {vesselIntel && intelSummary && (
            <div className="space-y-3">
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: RISK_COLORS[intelSummary.overallRisk] + "10",
                  borderColor: RISK_COLORS[intelSummary.overallRisk] + "33",
                }}
              >
                <p
                  className="text-sm font-bold"
                  style={{ color: RISK_COLORS[intelSummary.overallRisk] }}
                >
                  Overall Risk: {intelSummary.overallRisk}
                </p>
                <p className="text-xs text-[#8a9db0] mt-1">{intelSummary.summary}</p>
              </div>

              {vesselIntel.sanctionHits.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#4a6080] uppercase tracking-widest">
                    Sanction Hits ({vesselIntel.sanctionHits.length})
                  </p>
                  {vesselIntel.sanctionHits.map((hit, i) => (
                    <div key={i} className="bg-[#ff003310] border border-[#ff003333] rounded-lg p-3">
                      <div className="flex justify-between">
                        <span className="text-xs font-mono text-[#ff6666]">
                          {hit.regime} — {hit.listName}
                        </span>
                        <span className="text-xs text-[#ff6666]">
                          {(hit.confidence * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-xs text-[#4a6080] mt-1">Ref: {hit.reference}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#00ff88]">✓ No sanctions hits found</p>
              )}

              {vesselIntel.riskIndicators.length > 0 && (
                <div>
                  <p className="text-xs text-[#4a6080] uppercase tracking-widest mb-2">
                    Risk Indicators
                  </p>
                  {vesselIntel.riskIndicators.map((ind, i) => (
                    <p key={i} className="text-xs text-[#ffcc00] mb-1">
                      › {ind}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
