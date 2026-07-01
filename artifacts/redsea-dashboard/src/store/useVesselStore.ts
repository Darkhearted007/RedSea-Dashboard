import { create } from "zustand"

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
}

type VesselState = {
  vessels: Record<string, Vessel>

  updateVessel: (vessel: Vessel) => void
  updateVesselStatic: (mmsi: string, patch: Partial<Pick<Vessel, "name" | "vesselType" | "flagState" | "destination">>) => void
  setVessels: (vessels: Vessel[]) => void
  clearVessels: () => void
}

export const useVesselStore = create<VesselState>((set) => ({
  vessels: {},

  updateVessel: (vessel) =>
    set((state) => ({
      vessels: {
        ...state.vessels,
        [vessel.mmsi]: {
          ...state.vessels[vessel.mmsi],
          ...vessel,
          timestamp: Date.now(),
        },
      },
    })),

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
      map[v.mmsi] = { ...v, timestamp: Date.now() }
    }
    set({ vessels: map })
  },

  clearVessels: () => set({ vessels: {} }),
}))
