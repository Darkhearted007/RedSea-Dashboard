import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { evaluateVesselThreat, THREAT_COLORS as THREAT_COLORS_MAP } from "@/lib/aisAnomalyDetector";
import type { VesselThreatProfile, AnomalyFlag, ThreatLevel } from "@/lib/aisAnomalyDetector";
import { enrichVesselIntelligence } from "@/lib/portIntelligence";
import {
  persistViolation,
  persistThreatProfile,
  persistPosition,
  persistSanctionsHit,
} from "@/lib/persistence";

export type { ThreatLevel, AnomalyFlag };
export { THREAT_COLORS_MAP as THREAT_COLORS };

export type Vessel = {
  mmsi: string;
  name?: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  timestamp: number;
};

export type ThreatProfile = VesselThreatProfile;

export type Violation = {
  clientId: string;
  detail: string;
  timestamp: number;
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

export function AISProvider({ children }: { children: React.ReactNode }) {
  const [vessels, setVessels] = useState<Record<string, Vessel>>({});
  const [threatProfiles, setThreatProfiles] = useState<Record<string, ThreatProfile>>({});
  const [violations, setViolations] = useState<Violation[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addViolation = useCallback((v: Violation) => {
    setViolations((prev) => [...prev.slice(-99), v]);
  }, []);

  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) {
      setConnectionStatus("no_key");
      return;
    }

    const PROXY_URL = `wss://${domain}/api/ais-stream`;

    const connect = () => {
      setConnectionStatus("connecting");
      const ws = new WebSocket(PROXY_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnectionStatus("connected");

      ws.onmessage = async (event) => {
        try {
          const text = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
          const raw = JSON.parse(text);

          const messageType: string = raw.MessageType;
          const meta = raw.MetaData;
          if (!meta) return;

          const mmsi = String(meta.MMSI);

          if (messageType === "ShipStaticData") {
            const s = raw.Message?.ShipStaticData;
            if (!s) return;
            setVessels((prev) => {
              const existing = prev[mmsi];
              if (!existing) return prev;
              return { ...prev, [mmsi]: { ...existing, name: s.Name?.trim() || existing.name } };
            });
            return;
          }

          if (messageType !== "PositionReport") return;

          const pos = raw.Message?.PositionReport;
          if (!pos) return;

          const lat = meta.latitude ?? pos.Latitude;
          const lon = meta.longitude ?? pos.Longitude;
          if (lat === 0 && lon === 0) return;

          const vessel: Vessel = {
            mmsi,
            name: meta.ShipName?.trim() || mmsi,
            lat,
            lon,
            speed: pos.Sog ?? 0,
            heading:
              pos.TrueHeading !== 511
                ? (pos.TrueHeading ?? pos.Cog ?? 0)
                : (pos.Cog ?? 0),
            timestamp: Date.now(),
          };

          setVessels((prev) => ({ ...prev, [mmsi]: vessel }));

          // ── Threat evaluation via the shared aisAnomalyDetector lib ──
          const profile = evaluateVesselThreat(vessel);
          setThreatProfiles((prev) => ({ ...prev, [mmsi]: profile }));

          if (profile.threatLevel !== "CLEAN") {
            persistThreatProfile(profile, vessel.lat, vessel.lon, vessel.speed, vessel.heading, vessel.name);
          }

          for (const flag of profile.flags) {
            if (flag.severity === "HIGH" || flag.severity === "CRITICAL") {
              const v: Violation = {
                clientId: mmsi,
                detail: `[${flag.severity}] ${flag.code}: ${flag.description}`,
                timestamp: Date.now(),
              };
              addViolation(v);
              persistViolation(mmsi, flag, profile.score, vessel.lat, vessel.lon);
            }
          }

          // ── Sanctions enrichment via portIntelligence lib ──
          const intel = enrichVesselIntelligence(mmsi, vessel.name);
          for (const hit of intel.sanctionHits) {
            persistSanctionsHit(mmsi, vessel.name, hit);
          }

          // ── Throttled position persistence ──
          persistPosition({ mmsi, lat: vessel.lat, lon: vessel.lon, speed: vessel.speed, heading: vessel.heading });

        } catch {
        }
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
    clean: profileList.filter(
      (p) => p.threatLevel === "CLEAN" || p.threatLevel === "LOW"
    ).length,
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
