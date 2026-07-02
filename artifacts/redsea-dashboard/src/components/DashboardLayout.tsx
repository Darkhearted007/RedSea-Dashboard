import { type ReactNode, useState } from "react"
import { Link, useLocation } from "wouter"

const NAV = [
  { href: "/dashboard/overview", label: "Overview", icon: "◉", color: "#00ffcc" },
  { href: "/dashboard/vessels", label: "Live Vessels", icon: "⛵", color: "#00ff88" },
  { href: "/dashboard/ports", label: "Port Intel", icon: "⚓", color: "#ffcc00" },
  { href: "/dashboard/documents", label: "Documents", icon: "🔒", color: "#ff6600" },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const Sidebar = () => (
    <aside
      className="flex flex-col w-56 flex-shrink-0 bg-[#0d1828] border-r border-[#1e2d45] h-full"
    >
      <Link
        href="/"
        className="block px-5 py-4 border-b border-[#1e2d45] hover:bg-[#162033] transition-colors"
      >
        <div className="font-bold font-mono text-[#00ffcc] text-sm tracking-widest">
          REDSEA LEDGER
        </div>
        <div className="text-[#4a6080] text-xs mt-0.5">Maritime Intelligence</div>
      </Link>

      <nav className="flex-1 p-3 overflow-y-auto">
        {NAV.map((item) => {
          const active = location === item.href || (item.href === "/dashboard/overview" && location === "/dashboard")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors cursor-pointer ${
                active ? "bg-[#1e2d45]" : "hover:bg-[#162033]"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span
                className="text-sm font-medium transition-colors"
                style={{ color: active ? item.color : "#8a9db0" }}
              >
                {item.label}
              </span>
              {active && (
                <span
                  className="ml-auto w-1 h-4 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-3 border-t border-[#1e2d45] flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
        <span className="text-[#4a6080] text-xs font-mono">live · v1.0</span>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-[#0b1220] text-[#e2e8f0] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar />
      </div>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 z-50 w-56">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0d1828] border-b border-[#1e2d45]">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[#8a9db0] hover:text-[#e2e8f0] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-mono text-[#00ffcc] text-sm font-bold tracking-widest">
            REDSEA LEDGER
          </span>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
