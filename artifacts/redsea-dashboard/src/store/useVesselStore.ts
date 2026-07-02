import { create } from "zustand"

export type TrailPoint = { lat: number; lon: number; timestamp: number }

export type Vessel = {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
  timestamp?: number
  name?: string
  vesselType?: string
  flagState?: string
  destination?: string
  callSign?: string
  imoNumber?: string
  draught?: number      // metres — proxy for cargo load
  typeCode?: number     // raw AIS type-of-ship code
  path: TrailPoint[]   // rolling history, newest last (max 200 pts)
}

const MAX_TRAIL = 200

type VesselState = {
  vessels: Record<string, Vessel>
  updateVessel: (vessel: Omit<Vessel, "path">) => void
  updateVesselStatic: (mmsi: string, patch: Partial<Pick<Vessel, "name" | "vesselType" | "flagState" | "destination" | "callSign" | "imoNumber" | "draught" | "typeCode">>) => void
  setVessels: (vessels: Omit<Vessel, "path">[]) => void
  clearVessels: () => void
}

export const useVesselStore = create<VesselState>((set) => ({
  vessels: {},

  updateVessel: (vessel) =>
    set((state) => {
      const existing = state.vessels[vessel.mmsi]
      const newPoint: TrailPoint = { lat: vessel.lat, lon: vessel.lon, timestamp: Date.now() }
      const prevPath = existing?.path ?? []
      // Avoid duplicate points (same position)
      const lastPt = prevPath[prevPath.length - 1]
      const isDuplicate = lastPt && lastPt.lat === vessel.lat && lastPt.lon === vessel.lon
      const path = isDuplicate
        ? prevPath
        : [...prevPath.slice(-(MAX_TRAIL - 1)), newPoint]
      return {
        vessels: {
          ...state.vessels,
          [vessel.mmsi]: {
            ...existing,
            ...vessel,
            path,
            timestamp: Date.now(),
          },
        },
      }
    }),

  updateVesselStatic: (mmsi, patch) =>
    set((state) => {
      const existing = state.vessels[mmsi]
      if (!existing) return state
      return {
        vessels: {
          ...state.vessels,
          [mmsi]: { ...existing, ...patch },
        },
      }
    }),

  setVessels: (vessels) => {
    const map: Record<string, Vessel> = {}
    for (const v of vessels) {
      map[v.mmsi] = { ...v, path: [], timestamp: Date.now() }
    }
    set({ vessels: map })
  },

  clearVessels: () => set({ vessels: {} }),
}))
