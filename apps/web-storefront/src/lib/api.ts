import { createApiClient, createEntityResolver } from '@shopnest/api-client'

/**
 * doc/06 §3 — le client est plateforme-agnostique ; c'est ICI qu'on injecte
 * les adaptateurs propres au web (localStorage, sous-domaine, navigation).
 */

const ACCESS_KEY = 'shopnest.access'
const REFRESH_KEY = 'shopnest.refresh'

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',

  tokenStorage: {
    getAccessToken: () => localStorage.getItem(ACCESS_KEY) ?? undefined,
    getRefreshToken: () => localStorage.getItem(REFRESH_KEY) ?? undefined,
    setTokens: ({ accessToken, refreshToken }) => {
      localStorage.setItem(ACCESS_KEY, accessToken)
      localStorage.setItem(REFRESH_KEY, refreshToken)
    },
    clear: () => {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    },
  },

  /** Storefront public : le tenant vient toujours du sous-domaine ou du domaine personnalisé. */
  getTenantId: () => {
    const [sub] = window.location.hostname.split('.')
    return sub && sub !== 'localhost' ? sub : undefined
  },

  onUnauthenticated: () => {
    window.location.assign('/login')
  },

  getLocale: () => navigator.language.slice(0, 2),
})

/**
 * doc/07 §3.1 — permet d'écrire `<Dropdown source={{ entity: 'categories' }} />`
 * sans que le composant connaisse le détail HTTP.
 */
export const entityResolver = createEntityResolver(api)
