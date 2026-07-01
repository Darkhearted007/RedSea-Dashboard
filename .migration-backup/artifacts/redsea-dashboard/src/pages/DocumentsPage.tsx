import { useState, useCallback } from "react"
import { analyseDocument, registerDocumentResult, getRegistryChain } from "@/lib/security/documentTamperDetector"
import type { DocumentAnalysisResult } from "@/lib/security/documentTamperDetector"

const CONFIDENCE_COLORS = {
  NONE: "#00ff88",
  LOW: "#88ff00",
  MEDIUM: "#ffcc00",
  HIGH: "#ff6600",
  DEFINITIVE: "#ff0033",
}

function RiskBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "#ff0033" : score >= 50 ? "#ff6600" : score >= 25 ? "#ffcc00" : "#00ff88"
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-[#0b1220] rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-mono" style={{ color }}>
        {score}/100
      </span>
    </div>
  )
}

export default function DocumentsPage() {
  const [dragging, setDragging] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null)
  const [chain, setChain] = useState(getRegistryChain())
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    setAnalysing(true)
    setResult(null)
    setError(null)

    try {
      let textContent: string | undefined
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        textContent = await file.text()
      }

      const analysis = await analyseDocument(file, textContent)
      await registerDocumentResult(analysis)
      setResult(analysis)
      setChain(getRegistryChain())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAnalysing(false)
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  return (
    <div className="p-6 space-y-6 text-[#e2e8f0] min-h-screen bg-[#0b1220]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Verification</h1>
        <p className="text-sm text-[#4a6080] mt-1">
          Tamper detection for maritime documents — bills of lading, manifests, port clearances
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="rounded-xl border-2 border-dashed transition-colors p-12 text-center cursor-pointer"
        style={{
          borderColor: dragging ? "#00ffcc" : "#1e2d45",
          backgroundColor: dragging ? "#00ffcc08" : "#162033",
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg"
          onChange={onFileChange}
        />
        <div className="text-4xl mb-3">📄</div>
        <p className="text-sm text-[#4a6080]">
          Drop a document here or <span className="text-[#00ffcc]">browse files</span>
        </p>
        <p className="text-xs text-[#2a3d55] mt-2">
          Supports PDF, DOCX, TXT, PNG, JPEG
        </p>
      </div>

      {analysing && (
        <div className="bg-[#162033] rounded-xl border border-[#1e2d45] p-6 text-center">
          <div className="inline-flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[#00ffcc] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#4a6080]">Running tamper detection analysis...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#ff003318] border border-[#ff003344] rounded-xl p-4 text-[#ff0033] text-sm">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="bg-[#162033] rounded-xl border border-[#1e2d45] overflow-hidden">
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              backgroundColor: result.isTampered ? "#ff003310" : "#00ff8810",
              borderBottom: `1px solid ${result.isTampered ? "#ff003333" : "#00ff8833"}`,
            }}
          >
            <div>
              <p className="font-mono text-sm">{result.fileName}</p>
              <p className="text-xs text-[#4a6080] mt-0.5">ID: {result.documentId}</p>
            </div>
            <span
              className="text-sm font-bold px-3 py-1 rounded"
              style={{
                color: result.isTampered ? "#ff0033" : "#00ff88",
                backgroundColor: result.isTampered ? "#ff003322" : "#00ff8822",
              }}
            >
              {result.isTampered ? "⚠ TAMPERED" : "✓ AUTHENTIC"}
            </span>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs text-[#4a6080] uppercase tracking-widest mb-2">Risk Score</p>
              <RiskBar score={result.riskScore} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Document Type", result.documentType],
                ["MIME Type", result.metadata.mimeType || "Unknown"],
                ["File Size", `${(result.metadata.fileSize / 1024).toFixed(1)} KB`],
                ["Tamper Confidence", result.tamperConfidence],
                ["File Hash", result.fileHash.substring(0, 24) + "..."],
                ["Analysed At", new Date(result.analysedAt).toLocaleTimeString()],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#0b1220] rounded-lg p-3">
                  <p className="text-xs text-[#4a6080] mb-1">{label}</p>
                  <p
                    className="font-mono text-xs"
                    style={
                      label === "Tamper Confidence"
                        ? { color: CONFIDENCE_COLORS[result.tamperConfidence as keyof typeof CONFIDENCE_COLORS] }
                        : {}
                    }
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {result.flags.length > 0 && (
              <div>
                <p className="text-xs text-[#4a6080] uppercase tracking-widest mb-3">
                  Anomaly Flags ({result.flags.length})
                </p>
                <div className="space-y-2">
                  {result.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3 border"
                      style={{
                        backgroundColor: CONFIDENCE_COLORS[flag.confidence as keyof typeof CONFIDENCE_COLORS] + "08",
                        borderColor: CONFIDENCE_COLORS[flag.confidence as keyof typeof CONFIDENCE_COLORS] + "33",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold">{flag.code}</span>
                        <span
                          className="text-xs font-mono"
                          style={{ color: CONFIDENCE_COLORS[flag.confidence as keyof typeof CONFIDENCE_COLORS] }}
                        >
                          {flag.confidence}
                        </span>
                      </div>
                      <p className="text-xs text-[#8a9db0]">{flag.description}</p>
                      {flag.evidence && (
                        <p className="text-xs text-[#4a6080] mt-1 font-mono">{flag.evidence}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {chain.length > 0 && (
        <div className="bg-[#162033] rounded-xl border border-[#1e2d45]">
          <div className="px-6 py-4 border-b border-[#1e2d45]">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#4a6080]">
              On-Chain Audit Registry ({chain.length} records)
            </h2>
          </div>
          <div className="divide-y divide-[#1e2d45]">
            {chain.slice().reverse().slice(0, 5).map((entry) => (
              <div key={entry.documentId} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs">{entry.documentId}</p>
                  <p className="text-xs text-[#4a6080] mt-0.5 font-mono">
                    {entry.chainHash.substring(0, 32)}...
                  </p>
                </div>
                <span
                  className="text-xs font-mono"
                  style={{ color: entry.result.isTampered ? "#ff0033" : "#00ff88" }}
                >
                  {entry.result.isTampered
                    ? `TAMPERED (${entry.result.riskScore})`
                    : `CLEAN (${entry.result.riskScore})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
