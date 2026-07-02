import "leaflet/dist/leaflet.css"
import { MapContainer, TileLayer, CircleMarker, Popup, AttributionControl } from "react-leaflet"
import { useMemo, useState, useCallback } from "react"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"
import { VESSEL_TYPE_COLORS, countryToFlag } from "@/lib/ais/midCodes"

const VESSEL_TYPES = [
  "TANKER", "CARGO", "PASSENGER", "FISHING",
  "MILITARY", "TUG", "SAR", "SAILING", "OTHER",
] as const

type VesselType = (typeof VESSEL_TYPES)[number]

// ─── Vessel markers rendered inside MapContainer ───────────────────────────

function VesselMarkers({
  vessels,
  threatProfiles,
  typeFilter,
  minSpeed,
  countryFilter,
}: {
  vessels: ReturnType<typeof Object.values<ReturnType<typeof useVesselStore.getState>["vessels"][string]>>
  threatProfiles: ReturnType<typeof useSecurityStore.getState>["threatProfiles"]
  typeFilter: Set<string>
  minSpeed: number
  countryFilter: string
}) {
  return (
    <>
      {vessels
        .filter((v) => {
          const vType = v.vesselType || "OTHER"
          if (typeFilter.size > 0 && !typeFilter.has(vType)) return false
          if (v.speed < minSpeed) return false
          if (countryFilter && v.flagState !== countryFilter) return false
          return true
        })
        .map((v) => {
          const profile = threatProfiles[v.mmsi]
          const threatLevel = profile?.threatLevel ?? "CLEAN"
          const score = profile?.score ?? 0
          const typeColor = VESSEL_TYPE_COLORS[v.vesselType as VesselType] ?? VESSEL_TYPE_COLORS.OTHER
          const threatColor = THREAT_COLORS[threatLevel]
          const isAlert = threatLevel === "HIGH" || threatLevel === "CRITICAL"
          const flag = countryToFlag(v.flagState ?? "")

          return (
            <CircleMarker
              key={v.mmsi}
              center={[v.lat, v.lon]}
              radius={isAlert ? 9 : 5}
              fillColor={typeColor}
              fillOpacity={0.92}
              color={isAlert ? threatColor : typeColor}
              weight={isAlert ? 2.5 : 0.5}
              opacity={isAlert ? 0.9 : 0.6}
            >
              <Popup
                closeButton={false}
                className="redsea-popup"
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "#e2e8f0",
                    background: "#162033",
                    padding: "10px 12px",
                    borderRadius: 8,
                    minWidth: 170,
                    border: "1px solid #1e2d45",
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ color: threatColor, fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>
                    {threatLevel}
                  </div>
                  <div style={{ color: "#8ab8d8", fontSize: 12, marginBottom: 2 }}>
                    {v.name || `MMSI ${v.mmsi}`}
                  </div>
                  <div style={{ color: "#4a6080", marginBottom: 6 }}>
                    {flag} {v.flagState || "Unknown flag"}
                  </div>
                  <div style={{ display: "flex", gap: 12, color: "#8ab8d8" }}>
                    <span>⚡ {v.speed.toFixed(1)} kn</span>
                    <span>🧭 {v.heading.toFixed(0)}°</span>
                  </div>
                  {v.destination && (
                    <div style={{ marginTop: 4, color: "#4a6080" }}>→ {v.destination}</div>
                  )}
                  {score > 0 && (
                    <div style={{ marginTop: 4, color: threatColor }}>Score: {score}/100</div>
                  )}
                  {profile?.flags?.[0] && (
                    <div
                      style={{
                        marginTop: 6,
                        background: "#1e2d45",
                        padding: "2px 6px",
                        borderRadius: 4,
                        color: "#ff8844",
                        fontSize: 10,
                      }}
                    >
                      {profile.flags[0].code}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
    </>
  )
}

// ─── Main map component ───────────────────────────────────────────────────────

export default function AISMap() {
  const vesselsObject = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()
  const vessels = useMemo(() => Object.values(vesselsObject), [vesselsObject])

  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [minSpeed, setMinSpeed] = useState(0)
  const [countryFilter, setCountryFilter] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const availableCountries = useMemo(() => {
    const set = new Set<string>()
    for (const v of vessels) {
      if (v.flagState && v.flagState !== "Unknown") set.add(v.flagState)
    }
    return Array.from(set).sort()
  }, [vessels])

  const toggleType = useCallback((t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }, [])

  const visibleCount = useMemo(() => {
    if (typeFilter.size === 0 && minSpeed === 0 && !countryFilter) return vessels.length
    return vessels.filter((v) => {
      const vType = v.vesselType || "OTHER"
      if (typeFilter.size > 0 && !typeFilter.has(vType)) return false
      if (v.speed < minSpeed) return false
      if (countryFilter && v.flagState !== countryFilter) return false
      return true
    }).length
  }, [vessels, typeFilter, minSpeed, countryFilter])

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[15, 43]}
        zoom={3}
        style={{ width: "100%", height: "100%", background: "#0b1220" }}
        attributionControl={false}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <AttributionControl position="bottomright" prefix={false} />
        <VesselMarkers
          vessels={vessels}
          threatProfiles={threatProfiles}
          typeFilter={typeFilter}
          minSpeed={minSpeed}
          countryFilter={countryFilter}
        />
      </MapContainer>

      {/* Vessel count badge */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-[#0b1220]/90 border border-[#1e2d45] rounded-lg px-3 py-1.5 font-mono text-xs text-[#00ffcc] backdrop-blur-sm pointer-events-none">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-pulse" />
        {visibleCount} vessels
        {(typeFilter.size > 0 || minSpeed > 0 || countryFilter) && (
          <span className="text-[#4a6080]">filtered</span>
        )}
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters((s) => !s)}
        className="absolute top-3 right-3 z-[1000] bg-[#0b1220]/90 border border-[#1e2d45] rounded-lg px-3 py-1.5 font-mono text-xs text-[#8a9db0] hover:text-[#e2e8f0] hover:border-[#00ffcc]/40 transition-colors backdrop-blur-sm"
      >
        {showFilters ? "✕ Close" : "⚙ Filters"}
      </button>

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute top-12 right-3 z-[1000] bg-[#0d1828]/95 border border-[#1e2d45] rounded-xl p-4 backdrop-blur-sm w-64 shadow-2xl">
          <p className="font-mono text-xs text-[#4a6080] uppercase tracking-widest mb-3">
            Vessel Type
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {VESSEL_TYPES.map((t) => {
              const active = typeFilter.has(t)
              const color = VESSEL_TYPE_COLORS[t] || VESSEL_TYPE_COLORS.OTHER
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className="px-2 py-0.5 rounded text-xs font-mono transition-all"
                  style={{
                    backgroundColor: active ? color + "33" : "#162033",
                    color: active ? color : "#4a6080",
                    border: `1px solid ${active ? color + "66" : "#1e2d45"}`,
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>

          <p className="font-mono text-xs text-[#4a6080] uppercase tracking-widest mb-2">
            Min Speed (kn)
          </p>
          <input
            type="range"
            min={0}
            max={25}
            value={minSpeed}
            onChange={(e) => setMinSpeed(Number(e.target.value))}
            className="w-full mb-1 accent-[#00ffcc]"
          />
          <div className="flex justify-between text-xs font-mono text-[#4a6080] mb-4">
            <span>0</span>
            <span className="text-[#00ffcc]">{minSpeed} kn</span>
            <span>25</span>
          </div>

          {availableCountries.length > 0 && (
            <>
              <p className="font-mono text-xs text-[#4a6080] uppercase tracking-widest mb-2">
                Flag State
              </p>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full bg-[#162033] border border-[#1e2d45] rounded px-2 py-1.5 text-xs font-mono text-[#e2e8f0] focus:outline-none focus:border-[#00ffcc]/40 mb-4"
              >
                <option value="">All flags</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {countryToFlag(c)} {c}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={() => {
              setTypeFilter(new Set())
              setMinSpeed(0)
              setCountryFilter("")
            }}
            className="w-full py-1.5 rounded text-xs font-mono text-[#4a6080] hover:text-[#e2e8f0] border border-[#1e2d45] hover:border-[#1e2d45] transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-3 z-[1000] bg-[#0b1220]/90 border border-[#1e2d45] rounded-lg p-3 backdrop-blur-sm">
        <p className="font-mono text-xs text-[#4a6080] uppercase tracking-widest mb-2">
          Threat Level
        </p>
        {(["CRITICAL", "HIGH", "MEDIUM", "CLEAN"] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: THREAT_COLORS[level] }}
            />
            <span className="text-xs font-mono text-[#8a9db0]">{level}</span>
          </div>
        ))}
      </div>

      {/* Popup CSS override */}
      <style>{`
        .redsea-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .redsea-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .redsea-popup .leaflet-popup-tip-container {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
