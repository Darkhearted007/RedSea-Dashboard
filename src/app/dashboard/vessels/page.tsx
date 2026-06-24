"use client"

import AISMap from "@/components/maps/AISMap"
import { useAISStream } from "@/hooks/useAISStream"

export default function VesselsPage() {
  // START STREAM ONCE (GLOBAL SCOPE)
  useAISStream()

  return (
    <div className="w-full h-screen bg-[#0b1220]">
      <AISMap />
    </div>
  )
}
