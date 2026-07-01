import { create } from "zustand"

export type Vessel = {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
  timestamp?: number
}

type VesselState = {
  vessels: Record<string, Vessel>

  // core actions
  updateVessel: (vessel: Vessel) => void
  setVessels: (vessels: Vessel[]) => void
  clearVessels: () => void
}

export const useVesselStore = create<VesselState>((set) => ({
  vessels: {},

  /**
   * Update single vessel (real-time AIS stream)
   */
  updateVessel: (vessel) =>
    set((state) => {
      const existing = state.vessels[vessel.mmsi]

      return {
        vessels: {
          ...state.vessels,
          [vessel.mmsi]: {
            ...existing,
            ...vessel,
            timestamp: Date.now(),
          },
        },
      }
    }),

  /**
   * Bulk replace vessels (useful for initial load / reset)
   */
  setVessels: (vessels) => {
    const map: Record<string, Vessel> = {}

    for (const v of vessels) {
      map[v.mmsi] = {
        ...v,
        timestamp: Date.now(),
      }
    }

    set({ vessels: map })
  },

  /**
   * Clear all vessels (useful for reconnect / reset)
   */
  clearVessels: () => set({ vessels: {} }),
}))
