import "leaflet/dist/leaflet.css"
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, AttributionControl, useMap } from "react-leaflet"
import { useMemo, useState, useCallback, useEffect } from "react"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"
import { VESSEL_TYPE_COLORS, countryToFlag } from "@/lib/ais/midCodes"

const VESSEL_TYPES = [
  "TANKER", "CARGO", "PASSENGER", "FISHING",
  "MILITARY", "TUG", "SAR", "SAILING", "OTHER",
] as const
type VesselType = (typeof VESSEL_TYPES)[number]

// ── Pan map to selected vessel ─────────────────────────────────────────────────
function MapPanner({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) return
    try {
      map.panTo([lat, lon], { animate: true, duration: 0.6 })
    } catch {
      // map may not be ready yet — ignore
    }
  }, [lat, lon, map])
  return null
}

// ── Vessel markers + trails ────────────────────────────────────────────────────
function VesselLayer({
  vessels, threatProfiles, typeFilter, minSpeed, countryFilter,
  selectedMmsi, onSelectVessel,
}: {
  vessels: ReturnType<typeof Object.values<ReturnType<typeof useVesselStore.getState>["vessels"][string]>>
  threatProfiles: ReturnType<typeof useSecurityStore.getState>["threatProfiles"]
  typeFilter: Set<string>
  minSpeed: number
  countryFilter: string
  selectedMmsi: string | null
  onSelectVessel: (mmsi: string) => void
}) {
  const filtered = vessels.filter((v) => {
    // Skip vessels with missing or invalid coordinates
    if (!isFinite(v.lat) || !isFinite(v.lon)) return false
    if (v.lat === 0 && v.lon === 0) return false
    const vType = v.vesselType || "OTHER"
    if (typeFilter.size > 0 && !typeFilter.has(vType)) return false
    if (Number(v.speed) < minSpeed) return false
    if (countryFilter && v.flagState !== countryFilter) return false
    return true
  })

  return (
    <>
      {/* Trails for ALL visible vessels (faint) */}
      {filtered.map((v) => {
        if (v.path.length < 2) return null
        const profile = threatProfiles[v.mmsi]
        const threatLevel = profile?.threatLevel ?? "CLEAN"
        const isSelected = v.mmsi === selectedMmsi
        if (isSelected) return null // selected trail rendered separately below
        const isAlert = threatLevel === "HIGH" || threatLevel === "CRITICAL"
        if (!isAlert) return null // only show faint trails for alert vessels
        const positions = v.path
          .filter((p) => isFinite(p.lat) && isFinite(p.lon))
          .map((p) => [p.lat, p.lon] as [number, number])
        if (positions.length < 2) return null
        return (
          <Polyline
            key={`trail-${v.mmsi}`}
            positions={positions}
            color={THREAT_COLORS[threatLevel]}
            weight={1.5}
            opacity={0.35}
            dashArray="4 6"
          />
        )
      })}

      {/* Selected vessel trail — bright + solid */}
      {filtered.map((v) => {
        if (v.mmsi !== selectedMmsi || v.path.length < 2) return null
        const positions = v.path
          .filter((p) => isFinite(p.lat) && isFinite(p.lon))
          .map((p) => [p.lat, p.lon] as [number, number])
        if (positions.length < 2) return null
        return (
          <Polyline
            key={`trail-selected-${v.mmsi}`}
            positions={positions}
            color="#00ffcc"
            weight={2.5}
            opacity={0.8}
          />
        )
      })}

      {/* Vessel markers */}
      {filtered.map((v) => {
        const profile = threatProfiles[v.mmsi]
        const threatLevel = profile?.threatLevel ?? "CLEAN"
        const score = profile?.score ?? 0
        const typeColor = VESSEL_TYPE_COLORS[v.vesselType as VesselType] ?? VESSEL_TYPE_COLORS.OTHER
        const threatColor = THREAT_COLORS[threatLevel]
        const isAlert = threatLevel === "HIGH" || threatLevel === "CRITICAL"
        const isSelected = v.mmsi === selectedMmsi
        const flag = countryToFlag(v.flagState ?? "")

        return (
          <CircleMarker
            key={v.mmsi}
            center={[v.lat, v.lon]}
            radius={isSelected ? 10 : isAlert ? 8 : 5}
            fillColor={typeColor}
            fillOpacity={isSelected ? 1 : 0.92}
            color={isSelected ? "#00ffcc" : isAlert ? threatColor : typeColor}
            weight={isSelected ? 3 : isAlert ? 2 : 0.5}
            opacity={isSelected ? 1 : isAlert ? 0.9 : 0.6}
            eventHandlers={{ click: () => onSelectVessel(v.mmsi) }}
          >
            <Popup closeButton={false} className="redsea-popup">
              <div
                style={{
                  fontFamily: "monospace", fontSize: 11, color: "#e2e8f0",
                  background: "#162033", padding: "10px 12px", borderRadius: 8,
                  minWidth: 170, border: "1px solid #1e2d45", lineHeight: 1.6,
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
                  <span>⚡ {Number(v.speed).toFixed(1)} kn</span>
                  <span>🧭 {Number(v.heading).toFixed(0)}°</span>
                </div>
                {v.destination && (
                  <div style={{ marginTop: 4, color: "#4a6080" }}>→ {v.destination}</div>
                )}
                {score > 0 && (
                  <div style={{ marginTop: 4, color: threatColor }}>Score: {score}/100</div>
                )}
                {profile?.flags?.[0] && (
                  <div style={{ marginTop: 4, fontSize: 10, color: "#ff9944" }}>
                    ⚠ {profile.flags[0].code}
                  </div>
                )}
                <div
                  onClick={() => onSelectVessel(v.mmsi)}
                  style={{ marginTop: 8, color: "#00ffcc", cursor: "pointer", fontSize: 10 }}
                >
                  View intelligence report →
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

// ── Main exported component ────────────────────────────────────────────────────
export default function AISMap({
  selectedMmsi = null,
  onSelectVessel = () => {},
}: {
  selectedMmsi?: string | null
  onSelectVessel?: (mmsi: string) => void
}) {
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [minSpeed, setMinSpeed] = useState(0)
  const [countryFilter, setCountryFilter] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const vesselMap = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()

  const vessels = useMemo(() => Object.values(vesselMap), [vesselMap])

  const countries = useMemo(() => {
    const seen = new Set<string>()
    for (const v of vessels) if (v.flagState) seen.add(v.flagState)
    return [...seen].sort()
  }, [vessels])

  const selectedVessel = selectedMmsi ? vesselMap[selectedMmsi] : null

  const toggleType = useCallback((t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }, [])

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[15, 45]}
        zoom={5}
        style={{ width: "100%", height: "100%", background: "#0b1220" }}
        attributionControl={false}
        zoomControl={false}
      >
        <AttributionControl position="bottomleft" prefix={false} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com">CARTO</a>'
          maxZoom={20}
        />
        {selectedVessel && selectedVessel.lat !== 0 && (
          <MapPanner lat={selectedVessel.lat} lon={selectedVessel.lon} />
        )}
        <VesselLayer
          vessels={vessels}
          threatProfiles={threatProfiles}
          typeFilter={typeFilter}
          minSpeed={minSpeed}
          countryFilter={countryFilter}
          selectedMmsi={selectedMmsi}
          onSelectVessel={onSelectVessel}
        />
      </MapContainer>

      {/* Filter panel */}
      <div className="absolute top-3 right-3 z-[1000]">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="bg-[#0b1220]/90 border border-[#1e2d45] rounded-lg px-3 py-2 text-xs font-mono text-[#8a9db0] hover:text-[#00ffcc] hover:border-[#00ffcc33] transition-all backdrop-blur-sm flex items-center gap-2"
        >
          ⚙ Filters {typeFilter.size + (minSpeed > 0 ? 1 : 0) + (countryFilter ? 1 : 0) > 0 && (
            <span className="text-[#00ffcc]">
              ({typeFilter.size + (minSpeed > 0 ? 1 : 0) + (countryFilter ? 1 : 0)})
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-2 bg-[#0b1220]/95 border border-[#1e2d45] rounded-xl p-4 w-56 backdrop-blur-sm space-y-3">
            <p className="text-xs font-mono text-[#4a6080] uppercase tracking-widest">Vessel Type</p>
            <div className="flex flex-wrap gap-1.5">
              {VESSEL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className="px-2 py-0.5 rounded text-xs font-mono transition-colors"
                  style={{
                    backgroundColor: typeFilter.has(t) ? (VESSEL_TYPE_COLORS[t] ?? "#4a6080") + "33" : "transparent",
                    color: typeFilter.has(t) ? (VESSEL_TYPE_COLORS[t] ?? "#8a9db0") : "#4a6080",
                    border: `1px solid ${typeFilter.has(t) ? (VESSEL_TYPE_COLORS[t] ?? "#4a6080") + "66" : "#1e2d45"}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs font-mono text-[#4a6080] uppercase tracking-widest mb-1">
                Min Speed: {minSpeed} kn
              </p>
              <input
                type="range" min={0} max={30} value={minSpeed}
                onChange={(e) => setMinSpeed(Number(e.target.value))}
                className="w-full accent-[#00ffcc]"
              />
            </div>

            {countries.length > 0 && (
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full bg-[#0b1220] border border-[#1e2d45] rounded text-xs font-mono text-[#8a9db0] p-1"
              >
                <option value="">All flags</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            <button
              onClick={() => { setTypeFilter(new Set()); setMinSpeed(0); setCountryFilter("") }}
              className="w-full py-1.5 rounded text-xs font-mono text-[#4a6080] hover:text-[#e2e8f0] border border-[#1e2d45] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Threat legend */}
      <div className="absolute bottom-6 right-3 z-[1000] bg-[#0b1220]/90 border border-[#1e2d45] rounded-lg p-3 backdrop-blur-sm">
        <p className="font-mono text-xs text-[#4a6080] uppercase tracking-widest mb-2">Threat Level</p>
        {(["CRITICAL", "HIGH", "MEDIUM", "CLEAN"] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: THREAT_COLORS[level] }} />
            <span className="text-xs font-mono text-[#8a9db0]">{level}</span>
          </div>
        ))}
      </div>

      <style>{`
        .redsea-popup .leaflet-popup-content-wrapper {
          background: transparent !important; box-shadow: none !important; padding: 0 !important;
        }
        .redsea-popup .leaflet-popup-content { margin: 0 !important; }
        .redsea-popup .leaflet-popup-tip-container { display: none !important; }
      `}</style>
    </div>
  )
}
