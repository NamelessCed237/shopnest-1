import {
  catalogEndpoints,
  checkoutEndpoints,
  createApiClient,
  createEntityResolver,
} from '@shopnest/api-client'

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

  /**
   * Storefront public : le tenant vient du sous-domaine ou du domaine
   * personnalisé.
   *
   * `localhost` n'en a pas. `VITE_DEV_TENANT` en tient lieu, exactement comme
   * dans le dashboard : sans lui, le catalogue et le paiement répondent
   * « tenant context missing » et la boutique reste vide sans explication.
   */
  getTenantId: () => {
    const [sub] = window.location.hostname.split('.')
    if (sub && sub !== 'localhost' && sub !== '127') return sub
    return import.meta.env.VITE_DEV_TENANT || undefined
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

/**
 * Les deux seuls domaines dont la boutique a besoin.
 *
 * Aucun repli sur une API factice, contrairement au dashboard : une vitrine
 * qui affiche des produits inventés et accepte des paiements imaginaires ne
 * ressemble pas à une démonstration, elle ressemble à une escroquerie. Sans
 * API, la boutique affiche une erreur — ce qui est la vérité.
 */
export const storefront = {
  catalog: catalogEndpoints(api),
  checkout: checkoutEndpoints(api),
}
