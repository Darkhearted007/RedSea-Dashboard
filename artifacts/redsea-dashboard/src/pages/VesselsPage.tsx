import AISMap from "@/components/maps/AISMap"
import { useSecureAISStream } from "@/hooks/useSecureAISStream"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { useMemo } from "react"
import { THREAT_COLORS } from "@/lib/security/aisAnomalyDetector"

export default function VesselsPage() {
  useSecureAISStream()

  const vessels = useVesselStore((s) => s.vessels)
  const { threatProfiles } = useSecurityStore()

  const stats = useMemo(() => {
    const profiles = Object.values(threatProfiles)
    return {
      total: Object.keys(vessels).length,
      critical: profiles.filter((p) => p.threatLevel === "CRITICAL").length,
      high: profiles.filter((p) => p.threatLevel === "HIGH").length,
    }
  }, [vessels, threatProfiles])

  return (
    <div className="relative w-full h-screen bg-[#0b1220]">
      <AISMap />

      <div className="absolute top-4 left-4 flex gap-3 z-10">
        {[
          { label: "VESSELS", value: stats.total, color: "#00ffcc" },
          { label: "CRITICAL", value: stats.critical, color: THREAT_COLORS.CRITICAL },
          { label: "HIGH", value: stats.high, color: THREAT_COLORS.HIGH },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg px-3 py-2 text-center"
            style={{ backgroundColor: "#162033cc", border: `1px solid ${s.color}33` }}
          >
            <p className="text-xs font-mono" style={{ color: s.color }}>{s.label}</p>
            <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 right-4 bg-[#162033cc] rounded-lg p-3 z-10 border border-[#1e2d45]">
        <p className="text-xs text-[#4a6080] uppercase tracking-widest mb-2">Threat Level</p>
        {(["CRITICAL", "HIGH", "MEDIUM", "CLEAN"] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: THREAT_COLORS[level] }}
            />
            <span className="text-xs font-mono text-[#8a9db0]">{level}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
