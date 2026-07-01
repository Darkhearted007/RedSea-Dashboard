import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"
import { VESSEL_TYPE_COLORS, countryToFlag } from "@/lib/ais/midCodes"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ""

const VESSEL_TYPES = ["TANKER", "CARGO", "PASSENGER", "FISHING", "MILITARY", "TUG", "SAR", "SAILING", "OTHER"] as const

// ─── Error boundary ───────────────────────────────────────────────────────────

class MapErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(err: Error) { return { error: err.message } }
  componentDidCatch(err: Error, info: ErrorInfo) { console.warn("AISMap error:", err.message, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#0b1220]">
          <div className="text-center p-8 rounded-xl border border-[#1e2d45] bg-[#162033]">
            <div className="text-4xl mb-4">🗺️</div>
            <p className="text-[#00ffcc] font-mono text-sm mb-2">MAP UNAVAILABLE</p>
            <p className="text-[#4a6080] text-xs max-w-xs">
              WebGL is not supported in this environment.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Arrow image factory ──────────────────────────────────────────────────────

function createArrowSDF(size: number): ImageData {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, size, size)
  const cx = size / 2
  const tip = 1
  const tailY = size - 2
  const notchY = size - size * 0.35
  ctx.fillStyle = "white"
  ctx.beginPath()
  ctx.moveTo(cx, tip)           // arrow tip (north)
  ctx.lineTo(size - 2, tailY)   // bottom-right
  ctx.lineTo(cx, notchY)        // notch center
  ctx.lineTo(2, tailY)          // bottom-left
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

// ─── GeoJSON builder ──────────────────────────────────────────────────────────

function buildGeoJSON(
  vessels: ReturnType<typeof Object.values<ReturnType<typeof useVesselStore.getState>["vessels"][string]>>,
  threatProfiles: ReturnType<typeof useSecurityStore.getState>["threatProfiles"],
  typeFilter: Set<string>,
  minSpeed: number,
  countryFilter: string
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const v of vessels) {
    const vType = v.vesselType || "OTHER"
    if (typeFilter.size > 0 && !typeFilter.has(vType)) continue
    if (v.speed < minSpeed) continue
    if (countryFilter && v.flagState !== countryFilter) continue

    const profile = threatProfiles[v.mmsi]
    const threatLevel = profile?.threatLevel || "CLEAN"
    const score = profile?.score ?? 0
    const typeColor = VESSEL_TYPE_COLORS[vType] || VESSEL_TYPE_COLORS.OTHER
    const threatColor = THREAT_COLORS[threatLevel]

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lon, v.lat] },
      properties: {
        mmsi: v.mmsi,
        name: v.name || v.mmsi,
        speed: v.speed,
        heading: v.heading,
        vesselType: vType,
        flagState: v.flagState || "",
        destination: v.destination || "",
        threatLevel,
        score,
        typeColor,
        threatColor,
        isAlert: threatLevel === "HIGH" || threatLevel === "CRITICAL" ? 1 : 0,
      },
    })
  }

  return { type: "FeatureCollection", features }
}

// ─── Main map component ───────────────────────────────────────────────────────

function AISMapInner() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const popupRef = useRef<mapboxgl.Popup | null>(null)

  const vesselsObject = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()
  const vessels = useMemo(() => Object.values(vesselsObject), [vesselsObject])

  const [mapError, setMapError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [minSpeed, setMinSpeed] = useState(0)
  const [countryFilter, setCountryFilter] = useState("")

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

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [43, 15],
        zoom: 3,
      })
      mapRef.current = map

      map.on("load", () => {
        // Add directional arrow image (SDF for icon-color tinting)
        const arrowData = createArrowSDF(24)
        map.addImage("vessel-arrow", {
          width: 24,
          height: 24,
          data: new Uint8ClampedArray(arrowData.data),
        }, { sdf: true })

        // GeoJSON source — updated every 200ms
        map.addSource("vessels", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        })

        // Layer 1: ALERT glow ring for HIGH/CRITICAL threats
        map.addLayer({
          id: "vessels-glow",
          type: "circle",
          source: "vessels",
          filter: ["==", ["get", "isAlert"], 1],
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["get", "score"],
              50, 14, 100, 22,
            ],
            "circle-color": ["get", "threatColor"],
            "circle-opacity": 0.18,
            "circle-blur": 1,
          },
        })

        // Layer 2: Main vessel circles colored by vessel type
        map.addLayer({
          id: "vessels-circle",
          type: "circle",
          source: "vessels",
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              2, 3,
              6, 5,
              10, 7,
            ],
            "circle-color": ["get", "typeColor"],
            "circle-opacity": 0.92,
            "circle-stroke-width": [
              "case",
              ["==", ["get", "isAlert"], 1], 2,
              0.5,
            ],
            "circle-stroke-color": [
              "case",
              ["==", ["get", "isAlert"], 1], ["get", "threatColor"],
              ["get", "typeColor"],
            ],
            "circle-stroke-opacity": 0.7,
          },
        })

        // Layer 3: Directional arrows (symbol layer, rotates with heading)
        map.addLayer({
          id: "vessels-heading",
          type: "symbol",
          source: "vessels",
          minzoom: 4,
          layout: {
            "icon-image": "vessel-arrow",
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              4, 0.55,
              8, 0.85,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
          paint: {
            "icon-color": ["get", "typeColor"],
            "icon-opacity": 0.9,
          },
        })

        // Layer 4: Vessel name labels at high zoom
        map.addLayer({
          id: "vessels-label",
          type: "symbol",
          source: "vessels",
          minzoom: 7,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-size": 10,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#c8d8e8",
            "text-halo-color": "#0b1220",
            "text-halo-width": 1.2,
          },
        })

        mapLoadedRef.current = true
      })

      map.on("error", (e) => setMapError(e.error?.message || "Map error"))

      // ── Popup on click ─────────────────────────────────────────────────────
      map.on("click", "vessels-circle", (e) => {
        const feat = e.features?.[0]
        if (!feat) return
        const p = feat.properties as Record<string, string | number>
        const flag = countryToFlag(String(p.flagState))
        const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number]

        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: 14,
          className: "redsea-popup",
        })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:monospace;font-size:11px;color:#e2e8f0;background:#162033;padding:10px;border-radius:8px;min-width:180px;border:1px solid #1e2d45">
              <div style="color:${p.threatColor};font-weight:bold;margin-bottom:6px;font-size:12px">${p.threatLevel}</div>
              <div style="margin-bottom:4px;color:#8ab8d8;font-size:12px">${p.name}</div>
              <div style="color:#4a6080;margin-bottom:6px">${flag} ${p.flagState || "Unknown flag"}</div>
              <div style="display:flex;gap:12px;color:#8ab8d8">
                <span>⚡ ${Number(p.speed).toFixed(1)} kn</span>
                <span>🧭 ${Number(p.heading).toFixed(0)}°</span>
              </div>
              <div style="margin-top:4px;color:#4a6080">
                <span style="background:#1e2d45;padding:2px 6px;border-radius:4px;color:${p.typeColor}">${p.vesselType}</span>
              </div>
              ${p.destination ? `<div style="margin-top:4px;color:#4a6080">→ ${p.destination}</div>` : ""}
              ${Number(p.score) > 0 ? `<div style="margin-top:4px;color:#ff6600">Score: ${p.score}/100</div>` : ""}
            </div>`)
          .addTo(map)
      })

      map.on("mouseenter", "vessels-circle", () => {
        map.getCanvas().style.cursor = "pointer"
      })
      map.on("mouseleave", "vessels-circle", () => {
        map.getCanvas().style.cursor = ""
      })

      map.addControl(new mapboxgl.NavigationControl(), "top-right")

    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Map failed to load")
    }

    return () => {
      popupRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, [])

  // ── Update GeoJSON source every 200ms ───────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const map = mapRef.current
      if (!map || !mapLoadedRef.current) return
      const source = map.getSource("vessels") as mapboxgl.GeoJSONSource | undefined
      if (!source) return
      const geojson = buildGeoJSON(vessels, threatProfiles, typeFilter, minSpeed, countryFilter)
      source.setData(geojson)
    }

    update()
    const interval = setInterval(update, 200)
    return () => clearInterval(interval)
  }, [vessels, threatProfiles, typeFilter, minSpeed, countryFilter])

  const mapUnavailable = !MAPBOX_TOKEN || mapError

  if (mapUnavailable) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0b1220]">
        <div className="text-center p-8 rounded-xl border border-[#1e2d45] bg-[#162033]">
          <div className="text-4xl mb-4">🗺️</div>
          {!MAPBOX_TOKEN ? (
            <>
              <p className="text-[#00ffcc] font-mono text-sm mb-2">MAP NOT CONFIGURED</p>
              <p className="text-[#4a6080] text-xs max-w-xs">
                Set <code className="text-[#8a9db0]">VITE_MAPBOX_TOKEN</code> in Secrets to enable the live vessel map.
              </p>
            </>
          ) : (
            <>
              <p className="text-[#00ffcc] font-mono text-sm mb-2">MAP UNAVAILABLE</p>
              <p className="text-[#4a6080] text-xs max-w-xs">
                WebGL is not supported in this environment.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

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
      <div ref={mapContainer} className="w-full h-full" />

      {/* Vessel count badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#0b1220]/90 border border-[#1e2d45] rounded-lg px-3 py-1.5 font-mono text-xs text-[#00ffcc] backdrop-blur-sm">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-pulse" />
        {visibleCount} vessels
        {(typeFilter.size > 0 || minSpeed > 0 || countryFilter) && (
          <span className="text-[#4a6080]">filtered</span>
        )}
      </div>

      {/* Filter toggle button */}
      <button
        onClick={() => setShowFilters((v) => !v)}
        className="absolute bottom-6 left-3 z-10 flex items-center gap-1.5 bg-[#0b1220]/90 border border-[#1e2d45] rounded-lg px-3 py-1.5 font-mono text-xs text-[#8ab8d8] hover:text-[#00ffcc] hover:border-[#00ffcc]/40 transition-colors backdrop-blur-sm"
        title="Toggle filters"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 2.5h10M3 6h6M5 9.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Filters
        {(typeFilter.size > 0 || minSpeed > 0 || countryFilter) && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc]" />
        )}
      </button>

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute bottom-14 left-3 z-10 bg-[#0b1220]/95 border border-[#1e2d45] rounded-xl p-4 backdrop-blur-sm w-56 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] text-[#4a6080] tracking-widest uppercase">Filters</span>
            {(typeFilter.size > 0 || minSpeed > 0 || countryFilter) && (
              <button
                onClick={() => { setTypeFilter(new Set()); setMinSpeed(0); setCountryFilter("") }}
                className="text-[10px] text-[#ff6600] hover:text-[#ff8844] font-mono"
              >
                clear
              </button>
            )}
          </div>

          {/* Vessel type checkboxes */}
          <p className="text-[10px] text-[#4a6080] uppercase tracking-widest mb-2">Vessel Type</p>
          <div className="grid grid-cols-2 gap-y-1 gap-x-2 mb-4">
            {VESSEL_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer group">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border transition-colors"
                  style={{
                    backgroundColor: typeFilter.has(t) ? (VESSEL_TYPE_COLORS[t] || "#4a7090") : "transparent",
                    borderColor: VESSEL_TYPE_COLORS[t] || "#4a7090",
                  }}
                  onClick={() => toggleType(t)}
                />
                <span
                  className="text-[10px] font-mono transition-colors"
                  style={{ color: typeFilter.has(t) ? (VESSEL_TYPE_COLORS[t] || "#8ab8d8") : "#4a6080" }}
                  onClick={() => toggleType(t)}
                >
                  {t}
                </span>
              </label>
            ))}
          </div>

          {/* Min speed slider */}
          <p className="text-[10px] text-[#4a6080] uppercase tracking-widest mb-1">
            Min Speed <span className="text-[#8ab8d8]">{minSpeed} kn</span>
          </p>
          <input
            type="range"
            min={0}
            max={25}
            step={0.5}
            value={minSpeed}
            onChange={(e) => setMinSpeed(Number(e.target.value))}
            className="w-full h-1 accent-[#00ffcc] mb-4"
          />

          {/* Flag country filter */}
          <p className="text-[10px] text-[#4a6080] uppercase tracking-widest mb-1">Flag State</p>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full bg-[#162033] border border-[#1e2d45] rounded text-xs text-[#8ab8d8] font-mono px-2 py-1 focus:outline-none focus:border-[#00ffcc]/40"
          >
            <option value="">All countries</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {countryToFlag(c)} {c}
              </option>
            ))}
          </select>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-[#1e2d45]">
            <p className="text-[10px] text-[#4a6080] uppercase tracking-widest mb-2">Vessel Types</p>
            <div className="grid grid-cols-2 gap-y-1">
              {(["TANKER", "CARGO", "PASSENGER", "FISHING"] as const).map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: VESSEL_TYPE_COLORS[t] }} />
                  <span className="text-[10px] font-mono text-[#4a6080]">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AISMap() {
  return (
    <MapErrorBoundary>
      <AISMapInner />
    </MapErrorBoundary>
  )
}
