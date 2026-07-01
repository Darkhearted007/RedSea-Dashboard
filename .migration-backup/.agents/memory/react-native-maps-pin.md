---
name: react-native-maps version pin
description: Must pin to exactly 1.18.0 in package.json; do NOT add to app.json plugins
---

# react-native-maps Version Pin

**Rule:** Pin `react-native-maps` to exactly `"1.18.0"` in `package.json`.

**Why:** This is the only version compatible with Expo Go as of SDK 54/55. Other versions crash.

**How to apply:** 
- Add to `devDependencies`: `"react-native-maps": "1.18.0"` (no caret, no tilde — exact version)
- Do NOT add `"react-native-maps"` to the `plugins` array in `app.json` — this will crash the app
- Use it as: `import MapView, { Marker } from 'react-native-maps'`
