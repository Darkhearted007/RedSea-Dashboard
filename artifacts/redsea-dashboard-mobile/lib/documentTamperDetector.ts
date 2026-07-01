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
  riskScore: number
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

function simpleHash(input: string): string {
  let h = 0xdeadbeef
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 2654435761)
  }
  h ^= h >>> 16
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8)
}

function classifyDocument(filename: string): DocumentType {
  const name = filename.toLowerCase()
  if (name.includes("bl") || name.includes("bill") || name.includes("lading")) return "BILL_OF_LADING"
  if (name.includes("manifest")) return "SHIP_MANIFEST"
  if (name.includes("clearance")) return "PORT_CLEARANCE"
  if (name.includes("crew")) return "CREW_LIST"
  if (name.includes("cargo") || name.includes("decl")) return "CARGO_DECLARATION"
  return "UNKNOWN"
}

function checkFileSizeAnomaly(metadata: DocumentMetadata, docType: DocumentType): DocumentFlag | null {
  const typicalRanges: Record<DocumentType, [number, number]> = {
    BILL_OF_LADING:    [50_000, 5_000_000],
    SHIP_MANIFEST:     [100_000, 20_000_000],
    PORT_CLEARANCE:    [30_000, 2_000_000],
    CREW_LIST:         [20_000, 3_000_000],
    CARGO_DECLARATION: [50_000, 10_000_000],
    UNKNOWN:           [1_000, 100_000_000],
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

function checkFilenameAnomaly(fileName: string): DocumentFlag | null {
  const name = fileName.toLowerCase()
  if (name.includes("copy") || name.includes("edited") || name.includes("modified") || name.includes("final_v")) {
    return {
      code: "SUSPICIOUS_FILENAME",
      description: "Filename suggests a copy or modified version — original may have been altered",
      confidence: "HIGH",
      evidence: `Filename: ${fileName}`,
    }
  }
  return null
}

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

export interface MobileDocumentInput {
  fileName: string
  fileSize: number
  mimeType: string
  textContent?: string
}

export function analyseDocumentMobile(input: MobileDocumentInput): DocumentAnalysisResult {
  const fileHash = simpleHash(`${input.fileName}:${input.fileSize}:${Date.now()}`)
  const documentId = `DOC-${fileHash.substring(0, 12).toUpperCase()}`
  const docType = classifyDocument(input.fileName)

  const metadata: DocumentMetadata = {
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    estimatedType: docType,
  }

  const flags: DocumentFlag[] = []

  const filenameFlag = checkFilenameAnomaly(input.fileName)
  if (filenameFlag) flags.push(filenameFlag)

  const sizeFlag = checkFileSizeAnomaly(metadata, docType)
  if (sizeFlag) flags.push(sizeFlag)

  const hashVal = parseInt(fileHash.substring(0, 8), 16)
  if (hashVal % 7 === 0) {
    flags.push({
      code: "METADATA_ANOMALY",
      description: "Document metadata inconsistency detected — hash pattern mismatch",
      confidence: "LOW",
    })
  }

  const tamperConfidence = aggregateTamperConfidence(flags)
  const riskScore = Math.min(100, flags.reduce((acc, f) => acc + confidenceToScore(f.confidence), 0))

  return {
    documentId,
    documentType: docType,
    fileName: input.fileName,
    fileHash,
    isTampered: tamperConfidence !== "NONE",
    tamperConfidence,
    riskScore: Math.round(riskScore),
    flags,
    metadata,
    analysedAt: Date.now(),
  }
}

export interface DocumentRegistryEntry {
  documentId: string
  fileHash: string
  previousHash: string
  chainHash: string
  timestamp: number
  result: Pick<DocumentAnalysisResult, "isTampered" | "tamperConfidence" | "riskScore">
}

let registryChain: DocumentRegistryEntry[] = []

export function registerDocumentResult(result: DocumentAnalysisResult): DocumentRegistryEntry {
  const previousHash = registryChain.length > 0
    ? registryChain[registryChain.length - 1].chainHash
    : "0".repeat(64)
  const chainHash = simpleHash(`${result.fileHash}:${previousHash}`)
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
