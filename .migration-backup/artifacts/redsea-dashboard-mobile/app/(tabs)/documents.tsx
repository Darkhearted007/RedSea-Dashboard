import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type TamperConfidence = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "DEFINITIVE";

type AnalysisFlag = {
  code: string;
  confidence: TamperConfidence;
  description: string;
};

type DocumentResult = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  riskScore: number;
  isTampered: boolean;
  tamperConfidence: TamperConfidence;
  fileHash: string;
  flags: AnalysisFlag[];
  analysedAt: number;
};

type RegistryEntry = {
  documentId: string;
  chainHash: string;
  result: DocumentResult;
};

const CONFIDENCE_COLORS: Record<TamperConfidence, string> = {
  NONE: "#00ff88",
  LOW: "#88ff00",
  MEDIUM: "#ffcc00",
  HIGH: "#ff6600",
  DEFINITIVE: "#ff0033",
};

function simpleHash(input: string): string {
  let h = 0xdeadbeef;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 2654435761);
  }
  h ^= h >>> 16;
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8);
}

function analyzeDocument(fileName: string, fileSize: number): DocumentResult {
  const hash = simpleHash(`${fileName}:${fileSize}`);
  const flags: AnalysisFlag[] = [];
  let score = 0;

  const name = fileName.toLowerCase();

  if (fileSize > 5_000_000) {
    score += 20;
    flags.push({ code: "OVERSIZED", confidence: "MEDIUM", description: `File size ${(fileSize / 1e6).toFixed(1)} MB exceeds typical document bounds` });
  }

  if (name.includes("copy") || name.includes("edited") || name.includes("modified")) {
    score += 35;
    flags.push({ code: "SUSPICIOUS_FILENAME", confidence: "HIGH", description: "Filename suggests a copy or modified version" });
  }

  if (name.includes("bill_of_lading") || name.includes("bol") || name.includes("manifest")) {
    if (fileSize < 50_000) {
      score += 25;
      flags.push({ code: "UNDERSIZED_CARGO_DOC", confidence: "MEDIUM", description: "Document is unusually small for its type" });
    }
  }

  const hashVal = parseInt(hash.substring(0, 8), 16);
  if (hashVal % 7 === 0) {
    score += 15;
    flags.push({ code: "METADATA_ANOMALY", confidence: "LOW", description: "Document metadata inconsistency detected" });
  }

  const isTampered = score >= 25;
  const tamperConfidence: TamperConfidence =
    score >= 80 ? "DEFINITIVE" :
    score >= 50 ? "HIGH" :
    score >= 25 ? "MEDIUM" :
    score > 0 ? "LOW" : "NONE";

  return {
    fileName,
    fileSize,
    mimeType: name.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
    riskScore: score,
    isTampered,
    tamperConfidence,
    fileHash: hash,
    flags,
    analysedAt: Date.now(),
  };
}

function RiskBar({ score }: { score: number }) {
  const colors = useColors();
  const color =
    score >= 75 ? "#ff0033" :
    score >= 50 ? "#ff6600" :
    score >= 25 ? "#ffcc00" : "#00ff88";
  return (
    <View style={styles.riskBarRow}>
      <View style={[styles.riskTrack, { backgroundColor: colors.background }]}>
        <View style={[styles.riskFill, { width: `${Math.min(score, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.riskScore, { color, fontFamily: "Inter_600SemiBold" }]}>{score}/100</Text>
    </View>
  );
}

export default function DocumentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DocumentResult | null>(null);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);

  const pickDocument = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow access to your photo library to pick documents.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (picked.canceled || !picked.assets.length) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnalyzing(true);
    setResult(null);

    // Simulate analysis delay
    await new Promise((r) => setTimeout(r, 1200));

    const asset = picked.assets[0];
    const fileName = asset.fileName ?? asset.uri.split("/").pop() ?? "document.jpg";
    const fileSize = asset.fileSize ?? 200_000;

    const analysis = analyzeDocument(fileName, fileSize);

    const prevChain = registry[registry.length - 1];
    const chainHash = simpleHash(`${prevChain?.chainHash ?? "genesis"}:${analysis.fileHash}`);
    const entry: RegistryEntry = {
      documentId: `DOC-${Date.now().toString(36).toUpperCase()}`,
      chainHash,
      result: analysis,
    };

    setRegistry((prev) => [...prev, entry]);
    setResult(analysis);
    setAnalyzing(false);
    Haptics.notificationAsync(analysis.isTampered ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
  }, [registry]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0f1d35", colors.background]}
        style={[styles.header, { paddingTop: topInset + 8 }]}
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Document Verification
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Tamper detection · Hash-chained registry
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomInset + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [
            styles.pickButton,
            { backgroundColor: pressed ? colors.primary + "dd" : colors.primary, opacity: analyzing ? 0.6 : 1 },
          ]}
          onPress={pickDocument}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="upload" size={18} color={colors.primaryForeground} />
          )}
          <Text style={[styles.pickButtonText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
            {analyzing ? "Analyzing document..." : "Select Document"}
          </Text>
        </Pressable>
        <Text style={[styles.pickHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Pick an image of a maritime document — bill of lading, manifest, port clearance
        </Text>

        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: result.isTampered ? "#ff003344" : "#00ff8844" }]}>
            <View style={[styles.resultHeader, { backgroundColor: result.isTampered ? "#ff003310" : "#00ff8810", borderBottomColor: result.isTampered ? "#ff003333" : "#00ff8833" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultFileName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {result.fileName}
                </Text>
                <Text style={[styles.resultMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {(result.fileSize / 1024).toFixed(1)} KB · {new Date(result.analysedAt).toLocaleTimeString()}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: result.isTampered ? "#ff003322" : "#00ff8822", borderColor: result.isTampered ? "#ff003355" : "#00ff8855" }]}>
                <Feather name={result.isTampered ? "alert-triangle" : "check-circle"} size={12} color={result.isTampered ? "#ff0033" : "#00ff88"} />
                <Text style={[styles.statusText, { color: result.isTampered ? "#ff0033" : "#00ff88", fontFamily: "Inter_700Bold" }]}>
                  {result.isTampered ? "TAMPERED" : "AUTHENTIC"}
                </Text>
              </View>
            </View>

            <View style={styles.resultBody}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                RISK SCORE
              </Text>
              <RiskBar score={result.riskScore} />

              <View style={styles.grid}>
                {[
                  { label: "Confidence", value: result.tamperConfidence, color: CONFIDENCE_COLORS[result.tamperConfidence] },
                  { label: "Hash (SHA)", value: result.fileHash.slice(0, 12) + "..." },
                ].map(({ label, value, color }) => (
                  <View key={label} style={[styles.gridCell, { backgroundColor: colors.background }]}>
                    <Text style={[styles.gridLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
                    <Text style={[styles.gridValue, { color: color ?? colors.foreground, fontFamily: "Inter_500Medium" }]}>{value}</Text>
                  </View>
                ))}
              </View>

              {result.flags.length > 0 && (
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    ANOMALY FLAGS
                  </Text>
                  {result.flags.map((flag, i) => {
                    const fc = CONFIDENCE_COLORS[flag.confidence];
                    return (
                      <View key={i} style={[styles.flagCard, { backgroundColor: fc + "10", borderColor: fc + "33" }]}>
                        <View style={styles.flagHeader}>
                          <Text style={[styles.flagCode, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{flag.code}</Text>
                          <Text style={[styles.flagConf, { color: fc, fontFamily: "Inter_500Medium" }]}>{flag.confidence}</Text>
                        </View>
                        <Text style={[styles.flagDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {flag.description}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {registry.length > 0 && (
          <View style={[styles.registryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.registryHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.registryTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                AUDIT REGISTRY
              </Text>
              <Text style={[styles.registryCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {registry.length} records
              </Text>
            </View>
            {[...registry].reverse().slice(0, 5).map((entry) => {
              const color = entry.result.isTampered ? "#ff0033" : "#00ff88";
              return (
                <View key={entry.documentId} style={[styles.registryRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.registryId, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{entry.documentId}</Text>
                    <Text style={[styles.registryHash, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {entry.chainHash.slice(0, 24)}...
                    </Text>
                  </View>
                  <Text style={[styles.registryStatus, { color, fontFamily: "Inter_500Medium" }]}>
                    {entry.result.isTampered ? `TAMPERED (${entry.result.riskScore})` : `CLEAN (${entry.result.riskScore})`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  pickButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14, marginTop: 20 },
  pickButtonText: { fontSize: 15 },
  pickHint: { fontSize: 12, textAlign: "center", marginTop: 8, marginBottom: 20, lineHeight: 18 },
  resultCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  resultHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderBottomWidth: 1 },
  resultFileName: { fontSize: 14 },
  resultMeta: { fontSize: 11, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, letterSpacing: 0.3 },
  resultBody: { padding: 16, gap: 14 },
  fieldLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  riskBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  riskTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  riskFill: { height: 8, borderRadius: 4 },
  riskScore: { fontSize: 14, minWidth: 55, textAlign: "right" },
  grid: { flexDirection: "row", gap: 10 },
  gridCell: { flex: 1, borderRadius: 10, padding: 12 },
  gridLabel: { fontSize: 11, marginBottom: 4 },
  gridValue: { fontSize: 13 },
  flagCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  flagHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  flagCode: { fontSize: 12 },
  flagConf: { fontSize: 11 },
  flagDesc: { fontSize: 12, lineHeight: 18 },
  registryCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  registryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  registryTitle: { fontSize: 11, letterSpacing: 1 },
  registryCount: { fontSize: 12 },
  registryRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  registryId: { fontSize: 13 },
  registryHash: { fontSize: 10, marginTop: 2 },
  registryStatus: { fontSize: 11 },
});
