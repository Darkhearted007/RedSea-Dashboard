import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THREAT_COLORS, useAIS, type ThreatLevel } from "@/context/AISContext";
import { useColors } from "@/hooks/useColors";

function InfoRow({ icon, label, value, valueColor }: {
  icon: string; label: string; value: string; valueColor?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {icon}  {label}
      </Text>
      <Text style={[styles.infoValue, { color: valueColor ?? colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
        {value}
      </Text>
    </View>
  );
}

function FlagCard({ code, severity, description }: {
  code: string; severity: string; description: string;
}) {
  const colors = useColors();
  const severityColor =
    severity === "CRITICAL" ? THREAT_COLORS.CRITICAL :
    severity === "HIGH" ? THREAT_COLORS.HIGH :
    severity === "MEDIUM" ? THREAT_COLORS.MEDIUM :
    "#4a6080";

  return (
    <View style={[styles.flagCard, { backgroundColor: colors.card, borderColor: severityColor + "33" }]}>
      <View style={styles.flagCardTop}>
        <View style={[styles.severityBadge, { backgroundColor: severityColor + "22", borderColor: severityColor + "55" }]}>
          <Text style={[styles.severityText, { color: severityColor, fontFamily: "Inter_600SemiBold" }]}>
            {severity}
          </Text>
        </View>
        <Text style={[styles.flagCode, { color: severityColor, fontFamily: "Inter_700Bold" }]}>
          {code}
        </Text>
      </View>
      <Text style={[styles.flagDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {description}
      </Text>
    </View>
  );
}

export default function VesselDetailScreen() {
  const { mmsi } = useLocalSearchParams<{ mmsi: string }>();
  const { vessels, threatProfiles } = useAIS();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const vessel = vessels[mmsi];
  const profile = threatProfiles[mmsi];
  const level: ThreatLevel = profile?.threatLevel ?? "CLEAN";
  const threatColor = THREAT_COLORS[level];
  const topInset = Platform.OS === "web" ? 0 : insets.top;

  if (!vessel) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Feather name="anchor" size={48} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Vessel not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: "#00ffcc", fontFamily: "Inter_600SemiBold" }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scorePercent = Math.min(100, profile?.score ?? 0);
  const scoreColor =
    scorePercent >= 80 ? THREAT_COLORS.CRITICAL :
    scorePercent >= 60 ? THREAT_COLORS.HIGH :
    scorePercent >= 40 ? THREAT_COLORS.MEDIUM :
    THREAT_COLORS.CLEAN;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0f1d35", colors.background]}
        style={[styles.header, { paddingTop: topInset + 12 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={[styles.threatIndicator, { backgroundColor: threatColor + "22", borderColor: threatColor + "55" }]}>
            <View style={[styles.threatDot, { backgroundColor: threatColor }]} />
            <Text style={[styles.threatLabel, { color: threatColor, fontFamily: "Inter_700Bold" }]}>
              {level}
            </Text>
          </View>
          <Text style={[styles.vesselName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {vessel.name && vessel.name !== vessel.mmsi ? vessel.name : `MMSI ${vessel.mmsi}`}
          </Text>
          <Text style={[styles.mmsiText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            MMSI: {vessel.mmsi}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Threat Score */}
        {scorePercent > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              THREAT SCORE
            </Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreValue, { color: scoreColor, fontFamily: "Inter_700Bold" }]}>
                {scorePercent}
              </Text>
              <Text style={[styles.scoreMax, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                /100
              </Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: colors.border }]}>
              <View
                style={[styles.scoreBarFill, { width: `${scorePercent}%` as any, backgroundColor: scoreColor }]}
              />
            </View>
          </View>
        )}

        {/* Position */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            POSITION
          </Text>
          <InfoRow icon="📍" label="Latitude" value={vessel.lat.toFixed(4) + "°"} />
          <InfoRow icon="📍" label="Longitude" value={vessel.lon.toFixed(4) + "°"} />
          <InfoRow icon="⚡" label="Speed" value={vessel.speed.toFixed(1) + " kn"} />
          <InfoRow icon="🧭" label="Heading" value={vessel.heading.toFixed(0) + "°"} />
          {vessel.flagState && (
            <InfoRow icon="🚩" label="Flag State" value={vessel.flagState} />
          )}
          {vessel.destination && (
            <InfoRow icon="→" label="Destination" value={vessel.destination} />
          )}
          {vessel.vesselType && (
            <InfoRow icon="🚢" label="Vessel Type" value={vessel.vesselType} />
          )}
        </View>

        {/* Flags */}
        {profile?.flags && profile.flags.length > 0 && (
          <View style={styles.flagsSection}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, paddingBottom: 10 }]}>
              ANOMALY FLAGS ({profile.flags.length})
            </Text>
            {profile.flags.map((f, i) => (
              <FlagCard
                key={i}
                code={f.code}
                severity={f.severity}
                description={f.description}
              />
            ))}
          </View>
        )}

        {/* No threats */}
        {(!profile || profile.flags.length === 0) && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cleanRow}>
              <Feather name="check-circle" size={20} color={THREAT_COLORS.CLEAN} />
              <Text style={[styles.cleanText, { color: THREAT_COLORS.CLEAN, fontFamily: "Inter_600SemiBold" }]}>
                No anomalies detected
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  headerBack: { marginBottom: 16, alignSelf: "flex-start" },
  headerContent: { gap: 6 },
  threatIndicator: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  threatDot: { width: 6, height: 6, borderRadius: 3 },
  threatLabel: { fontSize: 11, letterSpacing: 1 },
  vesselName: { fontSize: 22, letterSpacing: -0.4, marginTop: 4 },
  mmsiText: { fontSize: 13 },
  scroll: { flex: 1 },
  section: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 16, borderWidth: 1,
  },
  sectionTitle: { fontSize: 10, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1e2d45",
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 10 },
  scoreValue: { fontSize: 40, letterSpacing: -1 },
  scoreMax: { fontSize: 18 },
  scoreBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 3 },
  flagsSection: { marginTop: 12 },
  flagCard: {
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 10, padding: 14, borderWidth: 1,
  },
  flagCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  severityBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  severityText: { fontSize: 9, letterSpacing: 0.5 },
  flagCode: { fontSize: 13, flex: 1 },
  flagDesc: { fontSize: 12, lineHeight: 18 },
  cleanRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  cleanText: { fontSize: 14 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  notFoundText: { fontSize: 18 },
  backBtn: { marginTop: 8, padding: 12 },
  backBtnText: { fontSize: 15 },
});
