import { create } from "zustand"

export type Vessel = {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
}

type VesselStore = {
  vessels: Record<string, Vessel>

  updateVessel: (v: Vessel) => void

  setVessels: (vessels: Vessel[]) => void
}

export const useVesselStore = create<VesselStore>((set) => ({
  vessels: {},

  updateVessel: (v) =>
    set((state) => ({
      vessels: {
        ...state.vessels,
        [v.mmsi]: v,
      },
    })),

  setVessels: (vessels) =>
    set(() => {
      const map: Record<string, Vessel> = {}

      for (const v of vessels) {
        map[v.mmsi] = v
      }

      return { vessels: map }
    }),
}))
