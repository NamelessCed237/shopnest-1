import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { createApiClient, createEntityResolver } from '@shopnest/api-client'
import { useTenantStore } from '../stores/tenant.store'

/**
 * doc/05 §4 — les tokens vont dans expo-secure-store (Keychain / Keystore),
 * JAMAIS dans AsyncStorage. Même client partagé que le web, adaptateurs différents.
 */

const ACCESS_KEY = 'shopnest.access'
const REFRESH_KEY = 'shopnest.refresh'

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api',

  tokenStorage: {
    getAccessToken: () => SecureStore.getItemAsync(ACCESS_KEY).then((v) => v ?? undefined),
    getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY).then((v) => v ?? undefined),
    setTokens: async ({ accessToken, refreshToken }) => {
      await SecureStore.setItemAsync(ACCESS_KEY, accessToken)
      await SecureStore.setItemAsync(REFRESH_KEY, refreshToken)
    },
    clear: async () => {
      await SecureStore.deleteItemAsync(ACCESS_KEY)
      await SecureStore.deleteItemAsync(REFRESH_KEY)
    },
  },

  /** Mobile : pas de sous-domaine — le tenant est sélectionné explicitement. */
  getTenantId: () => useTenantStore.getState().tenantId,

  onUnauthenticated: () => router.replace('/auth/login'),
})

export const entityResolver = createEntityResolver(api)
