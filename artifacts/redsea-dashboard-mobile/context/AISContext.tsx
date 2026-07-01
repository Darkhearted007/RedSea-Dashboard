import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type Vessel = {
  mmsi: string;
  name?: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  timestamp: number;
};

export type ThreatLevel = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnomalyFlag = {
  code: string;
  severity: string;
  description: string;
};

export type ThreatProfile = {
  mmsi: string;
  threatLevel: ThreatLevel;
  score: number;
  flags: AnomalyFlag[];
};

export type Violation = {
  clientId: string;
  detail: string;
  timestamp: number;
};

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  CLEAN: "#00ff88",
  LOW: "#88ff00",
  MEDIUM: "#ffcc00",
  HIGH: "#ff6600",
  CRITICAL: "#ff0033",
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "no_key";

type AISContextType = {
  vessels: Record<string, Vessel>;
  threatProfiles: Record<string, ThreatProfile>;
  violations: Violation[];
  connectionStatus: ConnectionStatus;
  stats: { total: number; critical: number; high: number; medium: number; clean: number };
};

const AISContext = createContext<AISContextType>({
  vessels: {},
  threatProfiles: {},
  violations: [],
  connectionStatus: "no_key",
  stats: { total: 0, critical: 0, high: 0, medium: 0, clean: 0 },
});

function evaluateThreat(vessel: Vessel): ThreatProfile {
  const flags: AnomalyFlag[] = [];
  let score = 0;

  if (vessel.speed > 25) {
    score += 35;
    flags.push({ code: "EXTREME_SPEED", severity: "HIGH", description: `Speed ${vessel.speed.toFixed(1)} kn exceeds safe limit` });
  } else if (vessel.speed > 18) {
    score += 20;
    flags.push({ code: "HIGH_SPEED", severity: "MEDIUM", description: `Speed ${vessel.speed.toFixed(1)} kn — elevated` });
  }

  // Bandar Abbas (Iran) — sanctioned area
  if (vessel.lat > 25 && vessel.lat < 30 && vessel.lon > 54 && vessel.lon < 58) {
    score += 45;
    flags.push({ code: "SANCTIONED_PORT_PROXIMITY", severity: "CRITICAL", description: "Near Bandar Abbas — OFAC sanctioned" });
  }

  // Red Sea / Houthi risk zone
  if (vessel.lat > 12 && vessel.lat < 22 && vessel.lon > 38 && vessel.lon < 45) {
    score += 25;
    flags.push({ code: "CONFLICT_ZONE", severity: "HIGH", description: "Red Sea active conflict zone" });
  }

  if (vessel.heading === 0 && vessel.speed < 0.5) {
    // stationary — not a flag
  }

  const threatLevel: ThreatLevel =
    score >= 75 ? "CRITICAL" :
    score >= 50 ? "HIGH" :
    score >= 25 ? "MEDIUM" :
    score > 0 ? "LOW" : "CLEAN";

  return { mmsi: vessel.mmsi, threatLevel, score, flags };
}

export function AISProvider({ children }: { children: React.ReactNode }) {
  const [vessels, setVessels] = useState<Record<string, Vessel>>({});
  const [threatProfiles, setThreatProfiles] = useState<Record<string, ThreatProfile>>({});
  const [violations, setViolations] = useState<Violation[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("no_key");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addViolation = useCallback((v: Violation) => {
    setViolations((prev) => [...prev.slice(-99), v]);
  }, []);

  useEffect(() => {
    const API_KEY = process.env.EXPO_PUBLIC_AISSTREAM_API_KEY || "";
    if (!API_KEY) {
      setConnectionStatus("no_key");
      return;
    }

    const connect = () => {
      setConnectionStatus("connecting");
      const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        ws.send(JSON.stringify({
          APIKey: API_KEY,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FilterMessageTypes: ["PositionReport"],
        }));
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data as string);
          if (raw.MessageType !== "PositionReport") return;
          const pos = raw.Message?.PositionReport;
          const meta = raw.MetaData;
          if (!pos || !meta) return;

          const mmsi = String(meta.MMSI || pos.UserID);
          const lat = meta.latitude ?? pos.Latitude;
          const lon = meta.longitude ?? pos.Longitude;
          if (lat === 0 && lon === 0) return;

          const vessel: Vessel = {
            mmsi,
            name: meta.ShipName?.trim() || mmsi,
            lat,
            lon,
            speed: pos.Sog ?? 0,
            heading: pos.TrueHeading !== 511 ? (pos.TrueHeading ?? pos.Cog ?? 0) : (pos.Cog ?? 0),
            timestamp: Date.now(),
          };

          setVessels((prev) => ({ ...prev, [mmsi]: vessel }));

          const profile = evaluateThreat(vessel);
          setThreatProfiles((prev) => ({ ...prev, [mmsi]: profile }));

          for (const flag of profile.flags) {
            if (flag.severity === "HIGH" || flag.severity === "CRITICAL") {
              addViolation({ clientId: mmsi, detail: `[${flag.severity}] ${flag.code}: ${flag.description}`, timestamp: Date.now() });
            }
          }
        } catch {}
      };

      ws.onerror = () => setConnectionStatus("disconnected");
      ws.onclose = () => {
        setConnectionStatus("disconnected");
        reconnectRef.current = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [addViolation]);

  const vesselList = Object.values(vessels);
  const profileList = Object.values(threatProfiles);
  const stats = {
    total: vesselList.length,
    critical: profileList.filter((p) => p.threatLevel === "CRITICAL").length,
    high: profileList.filter((p) => p.threatLevel === "HIGH").length,
    medium: profileList.filter((p) => p.threatLevel === "MEDIUM").length,
    clean: profileList.filter((p) => p.threatLevel === "CLEAN" || p.threatLevel === "LOW").length,
  };

  return (
    <AISContext.Provider value={{ vessels, threatProfiles, violations, connectionStatus, stats }}>
      {children}
    </AISContext.Provider>
  );
}

export function useAIS() {
  return useContext(AISContext);
}
