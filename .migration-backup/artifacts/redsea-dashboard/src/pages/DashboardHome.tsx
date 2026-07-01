import { Link } from "wouter"

const NAV_ITEMS = [
  {
    href: "/dashboard/overview",
    label: "Overview",
    icon: "◉",
    description: "Fleet threat summary & violation log",
    color: "#00ffcc",
  },
  {
    href: "/dashboard/vessels",
    label: "Live Vessels",
    icon: "⛵",
    description: "Real-time AIS tracking with threat colouring",
    color: "#00ff88",
  },
  {
    href: "/dashboard/ports",
    label: "Port Intelligence",
    icon: "⚓",
    description: "OSINT enrichment, sanctions & route anomalies",
    color: "#ffcc00",
  },
  {
    href: "/dashboard/documents",
    label: "Document Verification",
    icon: "🔒",
    description: "Tamper detection & hash-chained audit registry",
    color: "#ff6600",
  },
]

export default function DashboardHome() {
  return (
    <div className="p-6 min-h-screen bg-[#0b1220] text-[#e2e8f0]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">RedSea Ledger</h1>
        <p className="text-sm text-[#4a6080] mt-2">
          Maritime intelligence platform — AIS tracking, threat detection, port OSINT
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group p-5 bg-[#162033] rounded-xl border border-[#1e2d45] hover:border-opacity-60 transition-all"
            style={{ borderColor: item.color + "22" }}
          >
            <div className="flex items-start gap-4">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-semibold" style={{ color: item.color }}>
                  {item.label}
                </p>
                <p className="text-xs text-[#4a6080] mt-1">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
