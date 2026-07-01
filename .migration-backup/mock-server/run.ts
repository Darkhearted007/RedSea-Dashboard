import { startMockAIS } from "./aisMockServer"

console.log("🚀 Starting AIS Mock Runner...")

startMockAIS(8081)

// KEEP PROCESS ALIVE (CRITICAL FOR TERMUX)
setInterval(() => {
  console.log("📡 AIS heartbeat alive")
}, 10000)
