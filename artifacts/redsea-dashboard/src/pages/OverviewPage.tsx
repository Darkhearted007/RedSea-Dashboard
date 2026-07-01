import { useMemo } from "react"
import { useVesselStore } from "@/store/useVesselStore"
import { useSecurityStore } from "@/store/useSecurityStore"
import { useSecureAISStream } from "@/hooks/useSecureAISStream"
import { THREAT_COLORS, type ThreatLevel } from "@/lib/security/aisAnomalyDetector"

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-[#162033] rounded-xl p-5 border border-[#1e2d45]">
      <p className="text-xs text-[#4a6080] uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-bold font-mono" style={{ color: color || "#e2e8f0" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#4a6080] mt-1">{sub}</p>}
    </div>
  )
}

function ThreatBadge({ level }: { level: ThreatLevel }) {
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded"
      style={{
        color: THREAT_COLORS[level],
        backgroundColor: THREAT_COLORS[level] + "22",
        border: `1px solid ${THREAT_COLORS[level]}44`,
      }}
    >
      {level}
    </span>
  )
}

export default function OverviewPage() {
  useSecureAISStream()

  const vessels = useVesselStore((s) => s.vessels)
  const { threatProfiles, violations } = useSecurityStore()

  const stats = useMemo(() => {
    const profiles = Object.values(threatProfiles)
    const total = Object.keys(vessels).length
    const critical = profiles.filter((p) => p.threatLevel === "CRITICAL").length
    const high = profiles.filter((p) => p.threatLevel === "HIGH").length
    const medium = profiles.filter((p) => p.threatLevel === "MEDIUM").length
    const clean = profiles.filter((p) => p.threatLevel === "CLEAN" || p.threatLevel === "LOW").length
    return { total, critical, high, medium, clean }
  }, [vessels, threatProfiles])

  const recentViolations = useMemo(() => violations.slice(-10).reverse(), [violations])

  const topThreats = useMemo(() => {
    return Object.values(threatProfiles)
      .filter((p) => p.threatLevel !== "CLEAN" && p.threatLevel !== "LOW")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [threatProfiles])

  return (
    <div className="p-6 space-y-6 text-[#e2e8f0] min-h-screen bg-[#0b1220]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fleet Overview</h1>
        <p className="text-sm text-[#4a6080] mt-1">
          Live threat intelligence across {stats.total} tracked vessels
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Vessels Tracked" value={stats.total} sub="live AIS feeds" />
        <StatCard
          label="Critical Threats"
          value={stats.critical}
          sub="requires immediate action"
          color={THREAT_COLORS.CRITICAL}
        />
        <StatCard
          label="High Risk"
          value={stats.high}
          sub="enhanced monitoring"
          color={THREAT_COLORS.HIGH}
        />
        <StatCard
          label="Clean"
          value={stats.clean}
          sub="no anomalies detected"
          color={THREAT_COLORS.CLEAN}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#162033] rounded-xl border border-[#1e2d45]">
          <div className="px-5 py-4 border-b border-[#1e2d45]">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080]">
              Top Threat Vessels
            </h2>
          </div>
          <div className="divide-y divide-[#1e2d45]">
            {topThreats.length === 0 ? (
              <p className="px-5 py-8 text-center text-[#4a6080] text-sm">
                No active threats detected
              </p>
            ) : (
              topThreats.map((p) => (
                <div key={p.mmsi} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm">{p.mmsi}</p>
                    <p className="text-xs text-[#4a6080] mt-0.5">
                      {p.flags[0]?.code || "Multiple flags"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-[#4a6080]">{p.score}</span>
                    <ThreatBadge level={p.threatLevel} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#162033] rounded-xl border border-[#1e2d45]">
          <div className="px-5 py-4 border-b border-[#1e2d45]">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080]">
              Security Violation Log
            </h2>
          </div>
          <div className="divide-y divide-[#1e2d45]">
            {recentViolations.length === 0 ? (
              <p className="px-5 py-8 text-center text-[#4a6080] text-sm">
                No violations recorded
              </p>
            ) : (
              recentViolations.map((v, i) => (
                <div key={i} className="px-5 py-3">
                  <p className="text-xs font-mono text-[#ff6600]">{v.detail}</p>
                  <p className="text-xs text-[#4a6080] mt-0.5">
                    MMSI: {v.clientId} · {new Date(v.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#162033] rounded-xl border border-[#1e2d45] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080] mb-4">
          Fleet Threat Distribution
        </h2>
        <div className="space-y-3">
          {(["CRITICAL", "HIGH", "MEDIUM", "CLEAN"] as ThreatLevel[]).map((level) => {
            const count =
              level === "CLEAN"
                ? stats.clean
                : level === "MEDIUM"
                ? stats.medium
                : level === "HIGH"
                ? stats.high
                : stats.critical
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0

            return (
              <div key={level} className="flex items-center gap-3">
                <span
                  className="text-xs font-mono w-16 text-right"
                  style={{ color: THREAT_COLORS[level] }}
                >
                  {level}
                </span>
                <div className="flex-1 bg-[#0b1220] rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: THREAT_COLORS[level],
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[#4a6080] w-8 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
