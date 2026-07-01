/**
 * Security-enhanced vessel store
 * Extends base useVesselStore with threat profiles and intelligence data
 */
import { create } from "zustand"
import type { VesselThreatProfile } from "@/lib/security/aisAnomalyDetector"
import type { VesselIntelligence } from "@/lib/intelligence/portIntelligence"

type SecurityState = {
  threatProfiles: Record<string, VesselThreatProfile>
  intelligence: Record<string, VesselIntelligence>
  violations: Array<{ clientId: string; detail: string; timestamp: number }>

  upsertThreatProfile: (profile: VesselThreatProfile) => void
  upsertIntelligence: (intel: VesselIntelligence) => void
  addViolation: (v: { clientId: string; detail: string; timestamp: number }) => void
  clearAll: () => void
}

export const useSecurityStore = create<SecurityState>((set) => ({
  threatProfiles: {},
  intelligence: {},
  violations: [],

  upsertThreatProfile: (profile) =>
    set((state) => ({
      threatProfiles: { ...state.threatProfiles, [profile.mmsi]: profile },
    })),

  upsertIntelligence: (intel) =>
    set((state) => ({
      intelligence: { ...state.intelligence, [intel.mmsi]: intel },
    })),

  addViolation: (v) =>
    set((state) => ({
      violations: [...state.violations.slice(-99), v],
    })),

  clearAll: () => set({ threatProfiles: {}, intelligence: {}, violations: [] }),
}))
