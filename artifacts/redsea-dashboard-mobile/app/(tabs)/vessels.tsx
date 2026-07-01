import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THREAT_COLORS, useAIS, type ThreatLevel, type Vessel, type ThreatProfile } from "@/context/AISContext";
import { useColors } from "@/hooks/useColors";

const THREAT_ORDER: Record<ThreatLevel, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, CLEAN: 4,
};

function VesselRow({ vessel, profile }: { vessel: Vessel; profile?: ThreatProfile }) {
  const colors = useColors();
  const level: ThreatLevel = profile?.threatLevel ?? "CLEAN";
  const color = THREAT_COLORS[level];

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      activeOpacity={0.7}
    >
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={[styles.mmsi, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {vessel.name && vessel.name !== vessel.mmsi ? vessel.name : `MMSI ${vessel.mmsi}`}
          </Text>
          <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
            <Text style={[styles.badgeText, { color, fontFamily: "Inter_600SemiBold" }]}>{level}</Text>
          </View>
        </View>
        <View style={styles.rowMeta}>
          <View style={styles.metaItem}>
            <Feather name="navigation" size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {vessel.speed.toFixed(1)} kn
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="compass" size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {vessel.heading.toFixed(0)}°
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {vessel.lat.toFixed(2)}, {vessel.lon.toFixed(2)}
            </Text>
          </View>
          {profile && profile.score > 0 && (
            <View style={styles.metaItem}>
              <Feather name="alert-circle" size={10} color={color} />
              <Text style={[styles.metaText, { color, fontFamily: "Inter_400Regular" }]}>
                Score {profile.score}
              </Text>
            </View>
          )}
        </View>
        {profile?.flags[0] && (
          <Text style={[styles.flagText, { color: "#ff8844", fontFamily: "Inter_400Regular" }]}>
            {profile.flags[0].code}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function VesselsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vessels, threatProfiles, connectionStatus, stats } = useAIS();

  const sortedVessels = useMemo(() => {
    return Object.values(vessels).sort((a, b) => {
      const la = THREAT_ORDER[threatProfiles[a.mmsi]?.threatLevel ?? "CLEAN"];
      const lb = THREAT_ORDER[threatProfiles[b.mmsi]?.threatLevel ?? "CLEAN"];
      return la - lb;
    });
  }, [vessels, threatProfiles]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const statusColor =
    connectionStatus === "connected" ? "#00ff88" :
    connectionStatus === "connecting" ? "#ffcc00" : "#4a6080";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0f1d35", colors.background]}
        style={[styles.header, { paddingTop: topInset + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Live Vessels
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              AIS position stream
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { borderColor: colors.border }]}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statPillText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {stats.total}
              </Text>
            </View>
            {stats.critical > 0 && (
              <View style={[styles.statPill, { borderColor: colors.threatCritical + "44" }]}>
                <Text style={[styles.statPillText, { color: colors.threatCritical, fontFamily: "Inter_600SemiBold" }]}>
                  {stats.critical} CRIT
                </Text>
              </View>
            )}
            {stats.high > 0 && (
              <View style={[styles.statPill, { borderColor: colors.threatHigh + "44" }]}>
                <Text style={[styles.statPillText, { color: colors.threatHigh, fontFamily: "Inter_600SemiBold" }]}>
                  {stats.high} HIGH
                </Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {sortedVessels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="anchor" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {connectionStatus === "no_key" ? "Stream Not Configured" : "Waiting for Vessels"}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {connectionStatus === "no_key"
              ? "Set EXPO_PUBLIC_AISSTREAM_API_KEY to enable live tracking"
              : connectionStatus === "connecting"
              ? "Connecting to AIS stream..."
              : "No vessels in range"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedVessels}
          keyExtractor={(v) => v.mmsi}
          renderItem={({ item }) => (
            <VesselRow vessel={item} profile={threatProfiles[item.mmsi]} />
          )}
          scrollEnabled={!!sortedVessels.length}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  statPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, backgroundColor: "#162033" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statPillText: { fontSize: 11 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, textAlign: "center" },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  row: { flexDirection: "row", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "flex-start" },
  indicator: { width: 3, height: "100%", borderRadius: 2, marginRight: 12, minHeight: 40 },
  rowInfo: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  mmsi: { fontSize: 14 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, letterSpacing: 0.5 },
  rowMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },
  flagText: { fontSize: 11, marginTop: 4 },
});
