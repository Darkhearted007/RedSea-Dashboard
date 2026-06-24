import { startMockAIS } from "./aisMockServer.ts"

console.log("🚀 Starting AIS Mock Engine...")

startMockAIS(8081)

// keep alive
setInterval(() => {
  console.log("📡 AIS heartbeat...")
}, 10000)
