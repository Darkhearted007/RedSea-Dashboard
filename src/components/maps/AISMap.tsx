"use client"

import { useEffect, useMemo, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export default function AISMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const popupsRef = useRef<Map<string, mapboxgl.Popup>>(new Map())

  const vesselsObject = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()

  const vessels = useMemo(() => Object.values(vesselsObject), [vesselsObject])

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [3, 20],
      zoom: 2,
    })
  }, [])

  // Update markers with threat-aware colouring
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const activeIds = new Set(vessels.map((v) => v.mmsi))

    // Remove stale markers
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
        // Update colour
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
          </div>
        `

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: "redsea-popup",
        }).setHTML(popupContent)

        el.addEventListener("mouseenter", () => popup.addTo(map))
        el.addEventListener("mouseleave", () => popup.remove())

        const marker = new mapboxgl.Marker(el)
          .setLngLat([v.lon, v.lat])
          .addTo(map)

        markersRef.current.set(v.mmsi, marker)
        popupsRef.current.set(v.mmsi, popup)
      }
    })
  }, [vessels, threatProfiles])

  return <div ref={mapContainer} className="w-full h-screen" />
}
