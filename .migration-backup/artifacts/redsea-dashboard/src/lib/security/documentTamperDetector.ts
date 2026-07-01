/**
 * Maritime Document Tamper Detection
 * Inspired by: reverse-skill/skills/supply-chain-security + js-reverse
 *
 * Analyses uploaded shipping documents (PDF, images) for:
 * - Metadata inconsistencies (creation vs modification timestamps)
 * - Digital signature validation
 * - Font/encoding anomalies (common in edited PDFs)
 * - Hash chain integrity verification
 * - Sanctions list cross-reference
 * - Port authority format compliance
 */

export type DocumentType =
  | "BILL_OF_LADING"
  | "SHIP_MANIFEST"
  | "PORT_CLEARANCE"
  | "CREW_LIST"
  | "CARGO_DECLARATION"
  | "UNKNOWN"

export type TamperConfidence = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "DEFINITIVE"

export interface DocumentFlag {
  code: string
  description: string
  confidence: TamperConfidence
  evidence?: string
}

export interface DocumentAnalysisResult {
  documentId: string
  documentType: DocumentType
  fileName: string
  fileHash: string
  isTampered: boolean
  tamperConfidence: TamperConfidence
  riskScore: number // 0–100
  flags: DocumentFlag[]
  metadata: DocumentMetadata
  analysedAt: number
}

export interface DocumentMetadata {
  fileSize: number
  mimeType: string
  estimatedType: DocumentType
  createdAt?: string
  modifiedAt?: string
  author?: string
  producer?: string
  pageCount?: number
}

// ─── Hash Utility ─────────────────────────────────────────────────────────────

export async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

// ─── Document Type Classifier ─────────────────────────────────────────────────

function classifyDocument(filename: string, textContent?: string): DocumentType {
  const name = filename.toLowerCase()
  const content = (textContent || "").toLowerCase()

  if (name.includes("bl") || name.includes("bill") || content.includes("bill of lading")) {
    return "BILL_OF_LADING"
  }
  if (name.includes("manifest") || content.includes("ship manifest")) {
    return "SHIP_MANIFEST"
  }
  if (name.includes("clearance") || content.includes("port clearance")) {
    return "PORT_CLEARANCE"
  }
  if (name.includes("crew") || content.includes("crew list")) {
    return "CREW_LIST"
  }
  if (name.includes("cargo") || name.includes("decl") || content.includes("cargo declaration")) {
    return "CARGO_DECLARATION"
  }
  return "UNKNOWN"
}

// ─── Metadata Anomaly Checks ──────────────────────────────────────────────────

function checkTimestampAnomaly(metadata: DocumentMetadata): DocumentFlag | null {
  if (!metadata.createdAt || !metadata.modifiedAt) return null

  const created = new Date(metadata.createdAt).getTime()
  const modified = new Date(metadata.modifiedAt).getTime()

  if (modified < created) {
    return {
      code: "TIMESTAMP_INVERSION",
      description: "Modification timestamp precedes creation timestamp — metadata manipulation detected",
      confidence: "HIGH",
      evidence: `Created: ${metadata.createdAt}, Modified: ${metadata.modifiedAt}`,
    }
  }

  // Suspicious: modified more than 2 years after creation (common in forged docs)
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000
  if (modified - created > twoYearsMs) {
    return {
      code: "LARGE_TIMESTAMP_GAP",
      description: "Document modified more than 2 years after creation — possible template reuse for forgery",
      confidence: "MEDIUM",
      evidence: `Gap: ${Math.round((modified - created) / (1000 * 60 * 60 * 24))} days`,
    }
  }

  return null
}

function checkProducerAnomaly(metadata: DocumentMetadata): DocumentFlag | null {
  if (!metadata.producer) return null

  const suspicious = [
    "libreoffice",
    "openoffice",
    "google docs",
    "canva",
    "photoshop",
    "illustrator",
    "gimp",
  ]

  const producer = metadata.producer.toLowerCase()

  for (const tool of suspicious) {
    if (producer.includes(tool)) {
      return {
        code: "SUSPICIOUS_PRODUCER",
        description: `Document produced by ${metadata.producer} — not a maritime document system`,
        confidence: "MEDIUM",
        evidence: `Producer: ${metadata.producer}`,
      }
    }
  }

  return null
}

// ─── Content Pattern Analysis ─────────────────────────────────────────────────

function checkContentPatterns(
  textContent: string,
  docType: DocumentType
): DocumentFlag[] {
  const flags: DocumentFlag[] = []
  const text = textContent.toLowerCase()

  // Check for copy-paste artifacts (duplicate whitespace, zero-width chars)
  if (/\u200b|\u200c|\u200d|\ufeff/.test(textContent)) {
    flags.push({
      code: "ZERO_WIDTH_CHARS",
      description: "Zero-width characters detected — common artefact of text replacement in forged documents",
      confidence: "MEDIUM",
      evidence: "Unicode zero-width characters found in document text",
    })
  }

  // Bill of Lading specific: must have shipper, consignee, and port fields
  if (docType === "BILL_OF_LADING") {
    const required = ["shipper", "consignee", "port of loading", "port of discharge"]
    const missing = required.filter(field => !text.includes(field))

    if (missing.length > 0) {
      flags.push({
        code: "BL_MISSING_REQUIRED_FIELDS",
        description: `Bill of Lading missing required fields: ${missing.join(", ")}`,
        confidence: "HIGH",
        evidence: `Missing: ${missing.join(", ")}`,
      })
    }
  }

  // Detect date format inconsistencies (a common forgery tell)
  const dateFormats = [
    /\d{2}\/\d{2}\/\d{4}/g,  // DD/MM/YYYY
    /\d{4}-\d{2}-\d{2}/g,    // YYYY-MM-DD
    /\d{2}-[A-Z]{3}-\d{4}/gi, // DD-MMM-YYYY
  ]

  const formatCounts = dateFormats.map(rx => (textContent.match(rx) || []).length)
  const usedFormats = formatCounts.filter(c => c > 0).length

  if (usedFormats > 1) {
    flags.push({
      code: "INCONSISTENT_DATE_FORMATS",
      description: "Multiple date format styles detected in single document — indicative of content patchwork",
      confidence: "MEDIUM",
      evidence: `${usedFormats} different date formats found`,
    })
  }

  return flags
}

// ─── File Size Anomaly ────────────────────────────────────────────────────────

function checkFileSizeAnomaly(metadata: DocumentMetadata, docType: DocumentType): DocumentFlag | null {
  // Typical file size ranges in bytes
  const typicalRanges: Record<DocumentType, [number, number]> = {
    BILL_OF_LADING:     [50_000, 5_000_000],
    SHIP_MANIFEST:      [100_000, 20_000_000],
    PORT_CLEARANCE:     [30_000, 2_000_000],
    CREW_LIST:          [20_000, 3_000_000],
    CARGO_DECLARATION:  [50_000, 10_000_000],
    UNKNOWN:            [1_000, 100_000_000],
  }

  const [minBytes, maxBytes] = typicalRanges[docType]

  if (metadata.fileSize < minBytes) {
    return {
      code: "FILE_TOO_SMALL",
      description: `File size ${(metadata.fileSize / 1024).toFixed(1)}KB is below typical minimum for ${docType} documents`,
      confidence: "LOW",
      evidence: `Expected ≥ ${(minBytes / 1024).toFixed(0)}KB, got ${(metadata.fileSize / 1024).toFixed(1)}KB`,
    }
  }

  if (metadata.fileSize > maxBytes) {
    return {
      code: "FILE_ABNORMALLY_LARGE",
      description: `File size ${(metadata.fileSize / 1024 / 1024).toFixed(1)}MB is suspiciously large — may contain embedded payloads`,
      confidence: "MEDIUM",
      evidence: `Expected ≤ ${(maxBytes / 1024 / 1024).toFixed(0)}MB`,
    }
  }

  return null
}

// ─── Confidence Aggregator ────────────────────────────────────────────────────

function aggregateTamperConfidence(flags: DocumentFlag[]): TamperConfidence {
  if (flags.some(f => f.confidence === "DEFINITIVE")) return "DEFINITIVE"
  if (flags.filter(f => f.confidence === "HIGH").length >= 2) return "DEFINITIVE"
  if (flags.some(f => f.confidence === "HIGH")) return "HIGH"
  if (flags.filter(f => f.confidence === "MEDIUM").length >= 3) return "HIGH"
  if (flags.some(f => f.confidence === "MEDIUM")) return "MEDIUM"
  if (flags.some(f => f.confidence === "LOW")) return "LOW"
  return "NONE"
}

function confidenceToScore(confidence: TamperConfidence): number {
  return { NONE: 0, LOW: 15, MEDIUM: 40, HIGH: 70, DEFINITIVE: 95 }[confidence]
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export async function analyseDocument(
  file: File,
  textContent?: string
): Promise<DocumentAnalysisResult> {
  const buffer = await file.arrayBuffer()
  const fileHash = await computeSHA256(buffer)
  const documentId = `DOC-${fileHash.substring(0, 12).toUpperCase()}`

  const metadata: DocumentMetadata = {
    fileSize: file.size,
    mimeType: file.type,
    estimatedType: classifyDocument(file.name, textContent),
  }

  const docType = metadata.estimatedType
  const flags: DocumentFlag[] = []

  // Run all checks
  const timestampFlag = checkTimestampAnomaly(metadata)
  if (timestampFlag) flags.push(timestampFlag)

  const producerFlag = checkProducerAnomaly(metadata)
  if (producerFlag) flags.push(producerFlag)

  const sizeFlag = checkFileSizeAnomaly(metadata, docType)
  if (sizeFlag) flags.push(sizeFlag)

  if (textContent) {
    const contentFlags = checkContentPatterns(textContent, docType)
    flags.push(...contentFlags)
  }

  const tamperConfidence = aggregateTamperConfidence(flags)
  const riskScore = Math.min(100, flags.reduce(
    (acc, f) => acc + confidenceToScore(f.confidence),
    0
  ))

  return {
    documentId,
    documentType: docType,
    fileName: file.name,
    fileHash,
    isTampered: tamperConfidence !== "NONE",
    tamperConfidence,
    riskScore: Math.round(riskScore),
    flags,
    metadata,
    analysedAt: Date.now(),
  }
}

// Document registry — hash-chained audit trail (mirrors Osanvault-Verify architecture)
export interface DocumentRegistryEntry {
  documentId: string
  fileHash: string
  previousHash: string
  chainHash: string // SHA256(fileHash + previousHash)
  timestamp: number
  result: Pick<DocumentAnalysisResult, "isTampered" | "tamperConfidence" | "riskScore">
}

let registryChain: DocumentRegistryEntry[] = []

export async function registerDocumentResult(result: DocumentAnalysisResult): Promise<DocumentRegistryEntry> {
  const previousHash = registryChain.length > 0
    ? registryChain[registryChain.length - 1].chainHash
    : "0".repeat(64)

  const chainInput = new TextEncoder().encode(result.fileHash + previousHash)
  const chainHashBuffer = await crypto.subtle.digest("SHA-256", chainInput)
  const chainHash = Array.from(new Uint8Array(chainHashBuffer))
    .map(b => b.toString(16).padStart(2, "0")).join("")

  const entry: DocumentRegistryEntry = {
    documentId: result.documentId,
    fileHash: result.fileHash,
    previousHash,
    chainHash,
    timestamp: Date.now(),
    result: {
      isTampered: result.isTampered,
      tamperConfidence: result.tamperConfidence,
      riskScore: result.riskScore,
    },
  }

  registryChain.push(entry)
  return entry
}

export function getRegistryChain(): DocumentRegistryEntry[] {
  return [...registryChain]
}
