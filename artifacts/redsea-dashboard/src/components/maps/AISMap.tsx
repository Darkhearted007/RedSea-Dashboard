import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ""

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
            <p className="text-[#4a6080] text-xs max-w-xs">WebGL is not supported in this environment. The map will be available in a browser with hardware acceleration enabled.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AISMapInner() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const popupsRef = useRef<Map<string, mapboxgl.Popup>>(new Map())

  const vesselsObject = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()
  const vessels = useMemo(() => Object.values(vesselsObject), [vesselsObject])

  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [3, 20],
        zoom: 2,
      })
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Map failed to load")
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const activeIds = new Set(vessels.map((v) => v.mmsi))
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove()
        popupsRef.current.get(id)?.remove()
        markersRef.current.delete(id)
        popupsRef.current.delete(id)
      }
    })
    vessels.forEach((v) => {
      const profile = threatProfiles[v.mmsi]
      const threatLevel = profile?.threatLevel || "CLEAN"
      const color = THREAT_COLORS[threatLevel]
      const isPulsing = threatLevel === "CRITICAL" || threatLevel === "HIGH"
      const existing = markersRef.current.get(v.mmsi)
      if (existing) {
        existing.setLngLat([v.lon, v.lat])
        const el = existing.getElement()
        el.style.backgroundColor = color
        el.style.boxShadow = isPulsing ? `0 0 8px ${color}` : "none"
      } else {
        const el = document.createElement("div")
        el.style.width = "10px"
        el.style.height = "10px"
        el.style.borderRadius = "50%"
        el.style.backgroundColor = color
        el.style.border = `1px solid ${color}88`
        el.style.boxShadow = isPulsing ? `0 0 8px ${color}` : "none"
        el.style.cursor = "pointer"
        el.style.transition = "background-color 0.5s"
        const popupContent = `
          <div style="font-family:monospace;font-size:11px;color:#e2e8f0;background:#162033;padding:8px;border-radius:6px;min-width:160px">
            <div style="color:${color};font-weight:bold;margin-bottom:4px">${threatLevel}</div>
            <div>MMSI: ${v.mmsi}</div>
            <div>Speed: ${v.speed.toFixed(1)} kn</div>
            <div>Hdg: ${v.heading.toFixed(0)}°</div>
            ${profile ? `<div style="color:#4a6080;margin-top:4px">Score: ${profile.score}/100</div>` : ""}
            ${profile?.flags[0] ? `<div style="color:#ff6600;margin-top:2px;font-size:10px">${profile.flags[0].code}</div>` : ""}
          </div>`
        const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "redsea-popup" }).setHTML(popupContent)
        el.addEventListener("mouseenter", () => popup.addTo(map))
        el.addEventListener("mouseleave", () => popup.remove())
        const marker = new mapboxgl.Marker(el).setLngLat([v.lon, v.lat]).addTo(map)
        markersRef.current.set(v.mmsi, marker)
        popupsRef.current.set(v.mmsi, popup)
      }
    })
  }, [vessels, threatProfiles])

  const mapUnavailable = !MAPBOX_TOKEN || mapError

  if (mapUnavailable) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0b1220]">
        <div className="text-center p-8 rounded-xl border border-[#1e2d45] bg-[#162033]">
          <div className="text-4xl mb-4">🗺️</div>
          {!MAPBOX_TOKEN ? (
            <>
              <p className="text-[#00ffcc] font-mono text-sm mb-2">MAP NOT CONFIGURED</p>
              <p className="text-[#4a6080] text-xs max-w-xs">Set <code className="text-[#8a9db0]">VITE_MAPBOX_TOKEN</code> in Secrets to enable the live vessel map.</p>
            </>
          ) : (
            <>
              <p className="text-[#00ffcc] font-mono text-sm mb-2">MAP UNAVAILABLE</p>
              <p className="text-[#4a6080] text-xs max-w-xs">WebGL is not supported in this environment. The map will be available in a browser with hardware acceleration enabled.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return <div ref={mapContainer} className="w-full h-full" />
}

export default function AISMap() {
  return (
    <MapErrorBoundary>
      <AISMapInner />
    </MapErrorBoundary>
  )
}
