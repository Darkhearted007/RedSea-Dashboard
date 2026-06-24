import Link from "next/link"

export default function DashboardHome() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">RedSea Ledger</h1>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/overview" className="p-4 bg-[#162033] rounded-xl">
          Overview
        </Link>

        <Link href="/dashboard/vessels" className="p-4 bg-[#162033] rounded-xl">
          Live Vessels
        </Link>

        <Link href="/dashboard/ports" className="p-4 bg-[#162033] rounded-xl">
          Port Intelligence
        </Link>

        <Link href="/dashboard/documents" className="p-4 bg-[#162033] rounded-xl">
          Document Verification
        </Link>
      </div>
    </div>
  )
}
