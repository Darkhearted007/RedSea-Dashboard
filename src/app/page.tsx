export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b1220] text-white flex flex-col items-center justify-center px-6">
      
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-wide">
          RedSea Ledger
        </h1>

        <p className="mt-3 text-gray-400 max-w-md">
          Maritime Intelligence Platform for AIS tracking, port congestion prediction,
          anomaly detection, and blockchain document verification.
        </p>
      </div>

      {/* Status Card */}
      <div className="mt-10 bg-[#162033] border border-[#24324a] rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-3">
          System Status
        </h2>

        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex justify-between">
            <span>Frontend</span>
            <span className="text-green-400">● Online</span>
          </div>

          <div className="flex justify-between">
            <span>API Connection</span>
            <span className="text-yellow-400">● Pending</span>
          </div>

          <div className="flex justify-between">
            <span>AIS Stream</span>
            <span className="text-red-400">● Disconnected</span>
          </div>

          <div className="flex justify-between">
            <span>AI Engine</span>
            <span className="text-red-400">● Idle</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-10 grid grid-cols-2 gap-4 w-full max-w-md">
        <a
          href="/dashboard/overview"
          className="bg-[#162033] hover:bg-[#1d2a44] transition p-4 rounded-xl text-center"
        >
          Overview
        </a>

        <a
          href="/dashboard/vessels"
          className="bg-[#162033] hover:bg-[#1d2a44] transition p-4 rounded-xl text-center"
        >
          Live Vessels
        </a>

        <a
          href="/dashboard/ports"
          className="bg-[#162033] hover:bg-[#1d2a44] transition p-4 rounded-xl text-center"
        >
          Ports
        </a>

        <a
          href="/dashboard/documents"
          className="bg-[#162033] hover:bg-[#1d2a44] transition p-4 rounded-xl text-center"
        >
          Documents
        </a>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-gray-600">
        Edge-enabled maritime intelligence system
      </p>

    </div>
  )
}
