import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AISProvider } from "@/context/AISContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="vessel/[mmsi]"
        options={{
          headerShown: true,
          title: "Vessel Detail",
          headerStyle: { backgroundColor: "#0d1828" },
          headerTintColor: "#00ffcc",
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", color: "#e2e8f0" },
          headerBackTitle: "Vessels",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const isWeb = Platform.OS === "web";

  // On web: inject CSS @font-face aliases so that "Inter_700Bold" etc. always
  // resolve to a visible system font even when the Google Fonts CDN is blocked.
  useEffect(() => {
    if (!isWeb) return;
    const style = document.createElement("style");
    style.textContent = `
      @font-face { font-family: 'Inter_400Regular'; src: local('Inter'), local('Inter Regular'), local('Helvetica Neue'), local('Arial'); font-weight: 400; }
      @font-face { font-family: 'Inter_500Medium';  src: local('Inter Medium'), local('Inter'), local('Helvetica Neue'), local('Arial'); font-weight: 500; }
      @font-face { font-family: 'Inter_600SemiBold';src: local('Inter SemiBold'), local('Inter'), local('Helvetica Neue'), local('Arial'); font-weight: 600; }
      @font-face { font-family: 'Inter_700Bold';    src: local('Inter Bold'), local('Inter'), local('Helvetica Neue'), local('Arial'); font-weight: 700; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [isWeb]);

  // On web: render immediately (fonts are handled by CSS above).
  // On native: wait up to 3s then render anyway to avoid a permanent blank screen.
  const [fontTimeout, setFontTimeout] = useState(isWeb);
  useEffect(() => {
    if (isWeb) return;
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, [isWeb]);

  const ready = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) return null;

  // KeyboardProvider from react-native-keyboard-controller is native-only.
  // Skip it on web to avoid crashes in the Expo web preview.
  const content = (
    <AISProvider>
      <RootLayoutNav />
    </AISProvider>
  );

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {isWeb ? content : <KeyboardProviderNative>{content}</KeyboardProviderNative>}
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

function KeyboardProviderNative({ children }: { children: React.ReactNode }) {
  // Lazily import so the module is never evaluated on web
  const { KeyboardProvider } = require("react-native-keyboard-controller");
  return <KeyboardProvider>{children}</KeyboardProvider>;
}
