"use client"

import AISMap from "@/components/maps/AISMap"
import { useAISStream } from "@/hooks/useAISStream"

export default function VesselsPage() {
  useAISStream() // only here

  return (
    <div className="w-full h-screen bg-[#0b1220]">
      <AISMap />
    </div>
  )
}
