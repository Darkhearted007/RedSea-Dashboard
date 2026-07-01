import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THREAT_COLORS, useAIS, type ThreatLevel } from "@/context/AISContext";
import { useColors } from "@/hooks/useColors";

const THREAT_LEVELS: ThreatLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "CLEAN"];

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statDot, { backgroundColor: accent + "33", borderColor: accent + "66" }]}>
        <View style={[styles.statDotInner, { backgroundColor: accent }]} />
      </View>
      <Text style={[styles.statValue, { color: accent, fontFamily: "Inter_700Bold" }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
      <Text style={[styles.statSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sub}</Text>
    </View>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  const color =
    status === "connected" ? "#00ff88" :
    status === "connecting" ? "#ffcc00" : "#4a6080";
  const label =
    status === "connected" ? "LIVE" :
    status === "connecting" ? "CONNECTING" :
    status === "no_key" ? "NO API KEY" : "OFFLINE";

  return (
    <View style={[styles.badge, { borderColor: color + "44", backgroundColor: color + "11" }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
    </View>
  );
}

export default function OverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vessels, threatProfiles, violations, connectionStatus, stats } = useAIS();

  const topThreats = useMemo(
    () =>
      Object.values(threatProfiles)
        .filter((p) => p.threatLevel !== "CLEAN" && p.threatLevel !== "LOW")
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    [threatProfiles]
  );

  const recentViolations = useMemo(() => violations.slice(-8).reverse(), [violations]);

  const topInsetStyle = Platform.OS === "web" ? { paddingTop: 67 } : { paddingTop: insets.top + 8 };
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0f1d35", colors.background]}
        style={[styles.header, topInsetStyle]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Fleet Overview
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {stats.total} vessels tracked
            </Text>
          </View>
          <ConnectionBadge status={connectionStatus} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomInset + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <StatCard label="TRACKED" value={stats.total} sub="live AIS feeds" accent={colors.primary} />
          <StatCard label="CRITICAL" value={stats.critical} sub="immediate action" accent={colors.threatCritical} />
          <StatCard label="HIGH RISK" value={stats.high} sub="enhanced monitoring" accent={colors.threatHigh} />
          <StatCard label="CLEAN" value={stats.clean} sub="no anomalies" accent={colors.threatClean} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              THREAT DISTRIBUTION
            </Text>
          </View>
          <View style={styles.distributionBars}>
            {THREAT_LEVELS.map((level) => {
              const count =
                level === "CLEAN" ? stats.clean :
                level === "MEDIUM" ? stats.medium :
                level === "HIGH" ? stats.high : stats.critical;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const color = THREAT_COLORS[level];
              return (
                <View key={level} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color, fontFamily: "Inter_500Medium", width: 60 }]}>{level}</Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.background }]}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.barCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {count}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              TOP THREATS
            </Text>
            <Text style={[styles.sectionCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {topThreats.length}
            </Text>
          </View>
          {topThreats.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="shield" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No active threats
              </Text>
            </View>
          ) : (
            topThreats.map((p) => {
              const color = THREAT_COLORS[p.threatLevel];
              return (
                <Pressable
                  key={p.mmsi}
                  style={({ pressed }) => [styles.threatRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                >
                  <View style={styles.threatInfo}>
                    <Text style={[styles.threatMMSI, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {p.mmsi}
                    </Text>
                    <Text style={[styles.threatFlag, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {p.flags[0]?.code || "Multiple flags"}
                    </Text>
                  </View>
                  <View style={styles.threatRight}>
                    <Text style={[styles.threatScore, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {p.score}
                    </Text>
                    <View style={[styles.threatBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
                      <Text style={[styles.threatBadgeText, { color, fontFamily: "Inter_600SemiBold" }]}>
                        {p.threatLevel}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              VIOLATION LOG
            </Text>
            <Text style={[styles.sectionCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {recentViolations.length}
            </Text>
          </View>
          {recentViolations.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No violations recorded
              </Text>
            </View>
          ) : (
            recentViolations.map((v, i) => (
              <View key={i} style={[styles.violationRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.violationDetail, { color: "#ff8844", fontFamily: "Inter_400Regular" }]}>
                  {v.detail}
                </Text>
                <Text style={[styles.violationMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  MMSI {v.clientId} · {new Date(v.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  headerTitle: { fontSize: 26, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, letterSpacing: 0.8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  statCard: {
    width: "47%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  statDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statDotInner: { width: 10, height: 10, borderRadius: 5 },
  statValue: { fontSize: 32, lineHeight: 36 },
  statLabel: { fontSize: 12, letterSpacing: 0.5 },
  statSub: { fontSize: 11 },
  section: { marginHorizontal: 12, marginBottom: 12, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1e2d45" },
  sectionTitle: { fontSize: 11, letterSpacing: 1.2 },
  sectionCount: { fontSize: 12 },
  distributionBars: { padding: 16, gap: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { fontSize: 11, letterSpacing: 0.5, textAlign: "right" },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  barCount: { fontSize: 11, width: 24, textAlign: "right" },
  emptyState: { padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 13 },
  threatRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  threatInfo: { flex: 1 },
  threatMMSI: { fontSize: 13 },
  threatFlag: { fontSize: 11, marginTop: 2 },
  threatRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  threatScore: { fontSize: 12 },
  threatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  threatBadgeText: { fontSize: 10, letterSpacing: 0.5 },
  violationRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  violationDetail: { fontSize: 12 },
  violationMeta: { fontSize: 11, marginTop: 2 },
});
