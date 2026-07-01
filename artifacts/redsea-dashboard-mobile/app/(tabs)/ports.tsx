import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type PortProfile = {
  portCode: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  riskLevel: RiskLevel;
  sanctions: string[];
  notes: string[];
  congestion?: string;
};

const PORTS: PortProfile[] = [
  {
    portCode: "NGLAG",
    name: "Lagos (Apapa)",
    country: "Nigeria",
    lat: 6.44,
    lon: 3.39,
    riskLevel: "MEDIUM",
    sanctions: [],
    notes: ["High congestion typical", "Verify port authority clearance", "Inspection delays common"],
    congestion: "HEAVY",
  },
  {
    portCode: "GHTEM",
    name: "Tema Port",
    country: "Ghana",
    lat: 5.62,
    lon: -0.02,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Regional transshipment hub", "ECOWAS compliant", "Efficient clearance"],
    congestion: "CLEAR",
  },
  {
    portCode: "KETIZ",
    name: "Mombasa",
    country: "Kenya",
    lat: -4.04,
    lon: 39.66,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Key East Africa gateway", "KPA regulated"],
    congestion: "MODERATE",
  },
  {
    portCode: "ZADUR",
    name: "Durban",
    country: "South Africa",
    lat: -29.87,
    lon: 31.03,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Largest African port by volume", "SAMSA oversight"],
    congestion: "MODERATE",
  },
  {
    portCode: "IRBAN",
    name: "Bandar Abbas",
    country: "Iran",
    lat: 27.19,
    lon: 56.26,
    riskLevel: "CRITICAL",
    sanctions: ["OFAC", "EU", "UN"],
    notes: [
      "OFAC SDN listed — all transactions prohibited",
      "Severe risk — vessel touching may be sanctioned",
      "Known IRGC supply route",
    ],
    congestion: "CLOSED",
  },
  {
    portCode: "SYJDH",
    name: "Jeddah Islamic Port",
    country: "Saudi Arabia",
    lat: 21.49,
    lon: 39.17,
    riskLevel: "LOW",
    sanctions: [],
    notes: ["Major Red Sea hub", "KSA MAWANI port authority"],
    congestion: "MODERATE",
  },
];

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "#00ff88",
  MEDIUM: "#ffcc00",
  HIGH: "#ff6600",
  CRITICAL: "#ff0033",
};

const CONGESTION_COLORS: Record<string, string> = {
  CLEAR: "#00ff88",
  MODERATE: "#ffcc00",
  HEAVY: "#ff6600",
  CLOSED: "#ff0033",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  const color = RISK_COLORS[level];
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
      <Text style={[styles.badgeText, { color }]}>{level}</Text>
    </View>
  );
}

function PortDetail({ port }: { port: PortProfile }) {
  const colors = useColors();
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.detailScroll}>
      <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.detailName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {port.name}
            </Text>
            <Text style={[styles.detailCountry, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {port.country} · {port.portCode}
            </Text>
          </View>
          <RiskBadge level={port.riskLevel} />
        </View>

        <View style={styles.detailGrid}>
          {[
            { label: "Coordinates", value: `${port.lat.toFixed(2)}°, ${port.lon.toFixed(2)}°` },
            { label: "Congestion", value: port.congestion ?? "N/A", color: port.congestion ? CONGESTION_COLORS[port.congestion] : undefined },
          ].map(({ label, value, color }) => (
            <View key={label} style={[styles.metaCell, { backgroundColor: colors.background }]}>
              <Text style={[styles.metaCellLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {label}
              </Text>
              <Text style={[styles.metaCellValue, { color: color ?? colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {port.sanctions.length > 0 && (
          <View style={[styles.sanctionsBox, { backgroundColor: "#ff003310", borderColor: "#ff003333" }]}>
            <View style={styles.sanctionsHeader}>
              <Feather name="alert-triangle" size={14} color="#ff0033" />
              <Text style={[styles.sanctionsTitle, { color: "#ff0033", fontFamily: "Inter_700Bold" }]}>
                SANCTIONS ACTIVE
              </Text>
            </View>
            <View style={styles.sanctionChips}>
              {port.sanctions.map((s) => (
                <View key={s} style={[styles.sanctionChip, { backgroundColor: "#ff003322", borderColor: "#ff003344" }]}>
                  <Text style={[styles.sanctionChipText, { color: "#ff6666", fontFamily: "Inter_500Medium" }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View>
          <Text style={[styles.notesTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            INTELLIGENCE NOTES
          </Text>
          {port.notes.map((note, i) => (
            <View key={i} style={styles.noteRow}>
              <Feather name="chevron-right" size={12} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                {note}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

export default function PortsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PortProfile | null>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0f1d35", colors.background]}
        style={[styles.header, { paddingTop: topInset + 8 }]}
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Port Intelligence
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Risk profiles · Sanctions · OSINT
        </Text>
      </LinearGradient>

      {selected ? (
        <View style={{ flex: 1 }}>
          <Pressable
            style={[styles.backButton, { borderBottomColor: colors.border }]}
            onPress={() => { setSelected(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              PORT DATABASE
            </Text>
          </Pressable>
          <PortDetail port={selected} />
        </View>
      ) : (
        <FlatList
          data={PORTS}
          keyExtractor={(p) => p.portCode}
          scrollEnabled
          contentContainerStyle={{ paddingBottom: bottomInset + 100 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.portRow, { borderBottomColor: colors.border, backgroundColor: pressed ? colors.accent : "transparent" }]}
              onPress={() => { setSelected(item); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <View style={[styles.portIcon, { backgroundColor: RISK_COLORS[item.riskLevel] + "18" }]}>
                <Feather name="anchor" size={16} color={RISK_COLORS[item.riskLevel]} />
              </View>
              <View style={styles.portInfo}>
                <Text style={[styles.portName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {item.name}
                </Text>
                <Text style={[styles.portMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {item.country} · {item.portCode}
                </Text>
                {item.sanctions.length > 0 && (
                  <Text style={[styles.sanctionNote, { color: "#ff6666", fontFamily: "Inter_400Regular" }]}>
                    Sanctioned — {item.sanctions.join(", ")}
                  </Text>
                )}
              </View>
              <View style={styles.portRight}>
                <RiskBadge level={item.riskLevel} />
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backText: { fontSize: 12, letterSpacing: 0.8 },
  portRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  portIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  portInfo: { flex: 1 },
  portName: { fontSize: 15 },
  portMeta: { fontSize: 12, marginTop: 2 },
  sanctionNote: { fontSize: 11, marginTop: 2 },
  portRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  detailScroll: { flex: 1, padding: 16 },
  detailCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  detailName: { fontSize: 18 },
  detailCountry: { fontSize: 13, marginTop: 2 },
  detailGrid: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 8 },
  metaCell: { flex: 1, borderRadius: 10, padding: 12 },
  metaCellLabel: { fontSize: 11, marginBottom: 4 },
  metaCellValue: { fontSize: 13 },
  sanctionsBox: { margin: 16, borderRadius: 12, borderWidth: 1, padding: 14 },
  sanctionsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sanctionsTitle: { fontSize: 12, letterSpacing: 0.5 },
  sanctionChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sanctionChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  sanctionChipText: { fontSize: 11 },
  notesTitle: { fontSize: 11, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
