"use client"

import { useEffect, useMemo, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useVesselStore } from "@/store/useVesselStore"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export default function AISMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())

  // ✅ STABLE SELECTOR (FIXED)
  const vesselsObject = useVesselStore((s) => s.vessels)

  // ✅ SAFE DERIVATION (NO LOOP RISK)
  const vessels = useMemo(() => {
    return Object.values(vesselsObject)
  }, [vesselsObject])

  // INIT MAP
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [3, 20],
      zoom: 2,
    })
  }, [])

  // UPDATE MARKERS
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const activeIds = new Set(vessels.map(v => v.mmsi))

    // REMOVE OLD MARKERS
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    // ADD / UPDATE MARKERS
    vessels.forEach((v) => {
      const existing = markersRef.current.get(v.mmsi)

      if (existing) {
        existing.setLngLat([v.lon, v.lat])
      } else {
        const el = document.createElement("div")
        el.style.width = "10px"
        el.style.height = "10px"
        el.style.borderRadius = "50%"
        el.style.background = "#00ffff"

        const marker = new mapboxgl.Marker(el)
          .setLngLat([v.lon, v.lat])
          .addTo(map)

        markersRef.current.set(v.mmsi, marker)
      }
    })
  }, [vessels])

  return <div ref={mapContainer} className="w-full h-screen" />
}
