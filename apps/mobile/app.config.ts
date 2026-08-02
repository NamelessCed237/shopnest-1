import type { ExpoConfig } from 'expo/config'

/**
 * doc/05 §4 — AUCUN secret ici : tout ce qui est embarqué dans le bundle est public.
 * Les variables EXPO_PUBLIC_* sont, par définition, publiques.
 */
const config: ExpoConfig = {
  name: 'ShopNest',
  slug: 'shopnest',
  version: '0.1.0',
  scheme: 'shopnest',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: { supportsTablet: false, bundleIdentifier: 'app.shopnest.mobile' },
  android: { package: 'app.shopnest.mobile', edgeToEdgeEnabled: true },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: { typedRoutes: true },
  updates: {
    // doc/05 §6 — un correctif OTA ne peut jamais viser un runtime natif différent.
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: 'appVersion' },
}

export default config
