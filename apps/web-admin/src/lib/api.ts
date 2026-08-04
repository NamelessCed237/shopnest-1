import { adminEndpoints, authEndpoints, createApiClient } from '@shopnest/api-client'

/**
 * doc/06 §3 — le client est plateforme-agnostique ; c'est ICI qu'on injecte
 * les adaptateurs propres au web (localStorage, navigation).
 */

/*
 * Clés de jeton PROPRES à l'administration.
 *
 * Le dashboard vendeur utilise `shopnest.access` sur le même hôte en
 * développement : partager la clé ferait qu'une connexion admin écraserait la
 * session vendeur ouverte dans l'onglet voisin, et inversement. Les deux
 * sessions sont légitimes et doivent coexister.
 */
const ACCESS_KEY = 'shopnest.admin.access'
const REFRESH_KEY = 'shopnest.admin.refresh'

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_KEY) ?? undefined,
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY) ?? undefined,
  setTokens: ({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }) => {
    localStorage.setItem(ACCESS_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',

  tokenStorage,

  /**
   * AUCUN tenant.
   *
   * Le back-office plateforme travaille sur toutes les boutiques à la fois.
   * Envoyer un `X-Tenant-Id` ouvrirait un contexte tenant côté serveur et
   * ferait filtrer des requêtes qui doivent justement être transverses.
   */
  getTenantId: () => undefined,

  onUnauthenticated: () => {
    tokenStorage.clear()
    if (window.location.pathname !== '/login') window.location.assign('/login')
  },

  getLocale: () => navigator.language.slice(0, 2),
})

/**
 * Pas de mode démonstration ici, contrairement au dashboard vendeur.
 *
 * L'administration agit sur de VRAIES boutiques : changer un plan ou un thème
 * a des conséquences visibles pour un client. Une version simulée donnerait
 * l'illusion d'avoir agi.
 */
export const api = {
  auth: authEndpoints(apiClient),
  admin: adminEndpoints(apiClient),
}
