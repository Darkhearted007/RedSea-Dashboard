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

  // On web: render immediately — CDN may be unreachable in the Replit sandbox
  // so useFonts may never resolve. System fonts are used as a fallback.
  // On native: wait up to 3s then render anyway to avoid a permanent blank screen.
  const isWeb = Platform.OS === "web";
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
