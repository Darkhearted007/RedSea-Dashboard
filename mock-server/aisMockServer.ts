import { WebSocketServer } from "ws"

type Vessel = {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
}

const createVessel = (id: number): Vessel => ({
  mmsi: String(100000000 + id),
  lat: 20 + Math.random() * 20,
  lon: -20 + Math.random() * 60,
  speed: 8 + Math.random() * 12,
  heading: Math.random() * 360,
})

let vessels: Vessel[] = Array.from({ length: 20 }, (_, i) =>
  createVessel(i)
)

export const startMockAIS = (port: number = 8081) => {
  console.log("🔥 AIS SERVER INITIALIZING...")

  const wss = new WebSocketServer({ port })

  console.log(`🚢 Mock AIS running on ws://localhost:${port}`)

  wss.on("connection", (ws) => {
    console.log("📡 Client connected to AIS stream")

    const interval = setInterval(() => {
      vessels = vessels.map((v) => ({
        ...v,
        lat: v.lat + (Math.random() - 0.5) * 0.1,
        lon: v.lon + (Math.random() - 0.5) * 0.1,
        heading: (v.heading + Math.random() * 10) % 360,
      }))

      ws.send(JSON.stringify(vessels))
    }, 1000)

    ws.on("close", () => {
      console.log("❌ Client disconnected")
      clearInterval(interval)
    })
  })
}
