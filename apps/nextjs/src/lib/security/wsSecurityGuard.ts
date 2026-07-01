/**
 * WebSocket Security Hardening
 * Inspired by: reverse-skill/skills/api-security — Phase 2 (Auth) + Phase 6 (Rate Limiting)
 *
 * Protects the AIS WebSocket stream against:
 * - Unauthenticated connections
 * - Message injection attacks
 * - Replay attacks (timestamp + nonce validation)
 * - Rate limit abuse (DoS protection)
 * - Message schema violations (malformed AIS injection)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WSSecurityConfig {
  maxConnectionsPerIP: number    // default: 5
  maxMessagesPerMinute: number   // default: 120
  requireAuth: boolean           // default: true
  replayWindowMs: number         // default: 30_000 (30s)
  maxMessageSizeBytes: number    // default: 65_536 (64KB)
}

export interface WSAuditEvent {
  type: "CONNECT" | "DISCONNECT" | "VIOLATION" | "MESSAGE"
  clientId: string
  ip?: string
  timestamp: number
  detail?: string
  severity?: "INFO" | "WARN" | "BLOCK"
}

const DEFAULT_CONFIG: WSSecurityConfig = {
  maxConnectionsPerIP: 5,
  maxMessagesPerMinute: 120,
  requireAuth: true,
  replayWindowMs: 30_000,
  maxMessageSizeBytes: 65_536,
}

// ─── Rate Limiter (sliding window) ───────────────────────────────────────────

class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>()

  isAllowed(clientId: string, maxPerMinute: number): boolean {
    const now = Date.now()
    const windowStart = now - 60_000

    const timestamps = (this.windows.get(clientId) || []).filter(t => t > windowStart)
    timestamps.push(now)
    this.windows.set(clientId, timestamps)

    return timestamps.length <= maxPerMinute
  }

  clear(clientId: string) {
    this.windows.delete(clientId)
  }
}

// ─── Replay Attack Detector ───────────────────────────────────────────────────

class ReplayDetector {
  private seenNonces = new Map<string, number>() // nonce → timestamp

  isReplay(nonce: string, msgTimestamp: number, windowMs: number): boolean {
    const now = Date.now()

    // Prune expired nonces
    for (const [n, ts] of this.seenNonces.entries()) {
      if (now - ts > windowMs) this.seenNonces.delete(n)
    }

    // Check message timestamp is within window
    if (Math.abs(now - msgTimestamp) > windowMs) return true

    // Check nonce uniqueness
    if (this.seenNonces.has(nonce)) return true

    this.seenNonces.set(nonce, now)
    return false
  }
}

// ─── AIS Message Schema Validator ────────────────────────────────────────────

export interface AISMessage {
  mmsi: string
  lat: number
  lon: number
  speed: number
  heading: number
  timestamp?: number
  nonce?: string
}

function validateAISMessage(raw: unknown): { valid: boolean; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Message must be a JSON object" }
  }

  const msg = raw as Record<string, unknown>

  if (typeof msg.mmsi !== "string" || !/^\d{9}$/.test(msg.mmsi)) {
    return { valid: false, error: `Invalid MMSI: ${msg.mmsi}` }
  }

  if (typeof msg.lat !== "number" || msg.lat < -90 || msg.lat > 90) {
    return { valid: false, error: `Latitude out of range: ${msg.lat}` }
  }

  if (typeof msg.lon !== "number" || msg.lon < -180 || msg.lon > 180) {
    return { valid: false, error: `Longitude out of range: ${msg.lon}` }
  }

  if (typeof msg.speed !== "number" || msg.speed < 0 || msg.speed > 102.2) {
    return { valid: false, error: `Speed out of valid AIS range: ${msg.speed}` }
  }

  if (typeof msg.heading !== "number" || msg.heading < 0 || msg.heading > 360) {
    return { valid: false, error: `Heading out of range: ${msg.heading}` }
  }

  return { valid: true }
}

// ─── Token Validator (lightweight JWT-like) ───────────────────────────────────

export function validateAPIToken(token: string | null | undefined): boolean {
  if (!token) return false

  // In production: verify against your auth service / Supabase JWT
  // For now: check it's a Bearer token with minimum 32-char secret
  const match = token.match(/^Bearer\s+([A-Za-z0-9._-]{32,})$/)
  return !!match
}

// ─── Main Security Guard ──────────────────────────────────────────────────────

export class WSSecurityGuard {
  private config: WSSecurityConfig
  private rateLimiter = new SlidingWindowRateLimiter()
  private replayDetector = new ReplayDetector()
  private connectionsByIP = new Map<string, Set<string>>()
  private auditLog: WSAuditEvent[] = []

  constructor(config: Partial<WSSecurityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // Called on new WebSocket connection
  onConnect(clientId: string, ip: string, token?: string): { allowed: boolean; reason?: string } {
    // Auth check
    if (this.config.requireAuth && !validateAPIToken(token)) {
      this.audit({ type: "VIOLATION", clientId, ip, detail: "Missing or invalid auth token", severity: "BLOCK" })
      return { allowed: false, reason: "Unauthorized" }
    }

    // IP connection limit
    const ipClients = this.connectionsByIP.get(ip) || new Set()
    if (ipClients.size >= this.config.maxConnectionsPerIP) {
      this.audit({ type: "VIOLATION", clientId, ip, detail: `IP ${ip} exceeded max connections`, severity: "BLOCK" })
      return { allowed: false, reason: "Too many connections from this IP" }
    }

    ipClients.add(clientId)
    this.connectionsByIP.set(ip, ipClients)
    this.audit({ type: "CONNECT", clientId, ip, detail: "Connection established", severity: "INFO" })

    return { allowed: true }
  }

  // Called on every incoming message
  onMessage(
    clientId: string,
    rawData: string | Buffer
  ): { allowed: boolean; parsed?: AISMessage[]; reason?: string } {
    // Size check
    const byteLength = typeof rawData === "string"
      ? new TextEncoder().encode(rawData).length
      : rawData.length

    if (byteLength > this.config.maxMessageSizeBytes) {
      this.audit({ type: "VIOLATION", clientId, detail: `Oversized message: ${byteLength} bytes`, severity: "BLOCK" })
      return { allowed: false, reason: "Message too large" }
    }

    // Rate limit check
    if (!this.rateLimiter.isAllowed(clientId, this.config.maxMessagesPerMinute)) {
      this.audit({ type: "VIOLATION", clientId, detail: "Rate limit exceeded", severity: "BLOCK" })
      return { allowed: false, reason: "Rate limit exceeded" }
    }

    // Parse and validate
    let payload: unknown
    try {
      payload = JSON.parse(typeof rawData === "string" ? rawData : rawData.toString())
    } catch {
      this.audit({ type: "VIOLATION", clientId, detail: "Malformed JSON", severity: "WARN" })
      return { allowed: false, reason: "Invalid JSON" }
    }

    const messages = Array.isArray(payload) ? payload : [payload]
    const validated: AISMessage[] = []

    for (const msg of messages) {
      // Replay detection (if nonce/timestamp present)
      const m = msg as AISMessage
      if (m.nonce && m.timestamp) {
        if (this.replayDetector.isReplay(m.nonce, m.timestamp, this.config.replayWindowMs)) {
          this.audit({ type: "VIOLATION", clientId, detail: `Replay attack detected (nonce: ${m.nonce})`, severity: "BLOCK" })
          return { allowed: false, reason: "Replay attack detected" }
        }
      }

      const { valid, error } = validateAISMessage(msg)
      if (!valid) {
        this.audit({ type: "VIOLATION", clientId, detail: `Schema violation: ${error}`, severity: "WARN" })
        return { allowed: false, reason: error }
      }

      validated.push(m)
    }

    this.audit({ type: "MESSAGE", clientId, detail: `${validated.length} vessels processed`, severity: "INFO" })
    return { allowed: true, parsed: validated }
  }

  // Called on disconnect
  onDisconnect(clientId: string, ip: string) {
    const ipClients = this.connectionsByIP.get(ip)
    if (ipClients) {
      ipClients.delete(clientId)
      if (ipClients.size === 0) this.connectionsByIP.delete(ip)
    }
    this.rateLimiter.clear(clientId)
    this.audit({ type: "DISCONNECT", clientId, ip, detail: "Connection closed", severity: "INFO" })
  }

  private audit(event: Omit<WSAuditEvent, "timestamp">) {
    const entry: WSAuditEvent = { ...event, timestamp: Date.now() }
    this.auditLog.push(entry)
    // Keep last 1000 events in memory
    if (this.auditLog.length > 1000) this.auditLog.shift()
  }

  getAuditLog(limit = 50): WSAuditEvent[] {
    return this.auditLog.slice(-limit)
  }

  getViolations(limit = 20): WSAuditEvent[] {
    return this.auditLog.filter(e => e.type === "VIOLATION").slice(-limit)
  }
}
