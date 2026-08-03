import type { FetchOptionsFn } from '@shopnest/contracts'
import {
  authEndpoints,
  createApiClient,
  createEntityResolver,
  productsEndpoints,
} from '@shopnest/api-client'
import {
  fakeAuthEndpoints,
  fakeCategoryEndpoints,
  fakeProductEndpoints,
  fakeProductMutations,
  fakeVariantMutations,
} from './fake/fake-api'
import { fakeAnalyticsEndpoints, fakeOrderEndpoints } from './fake/fake-orders-api'
import { fakeCustomerEndpoints } from './fake/fake-customers-api'
import { fakeCategoryCrudEndpoints } from './fake/fake-categories-api'

/**
 * doc/06 §3 — le client est plateforme-agnostique ; c'est ICI qu'on injecte
 * les adaptateurs propres au web (localStorage, sous-domaine, navigation).
 */

const ACCESS_KEY = 'shopnest.access'
const REFRESH_KEY = 'shopnest.refresh'

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

  /** Dashboard vendeur : le tenant vient du sous-domaine. */
  getTenantId: () => {
    const [sub] = window.location.hostname.split('.')
    return sub && sub !== 'localhost' ? sub : undefined
  },

  /**
   * Appelé quand le refresh a échoué : la session est morte, on repart du login.
   * `assign` plutôt que le routeur — on veut aussi vider l'état React en mémoire.
   */
  onUnauthenticated: () => {
    tokenStorage.clear()
    if (window.location.pathname !== '/login') window.location.assign('/login')
  },

  getLocale: () => navigator.language.slice(0, 2),
})

/**
 * Bascule API réelle / API factice.
 *
 * Tant que la base n'est pas accessible, `VITE_FAKE_API=true` permet de développer
 * et de démontrer les écrans. Le garde-fou ci-dessous rend l'oubli impossible :
 * un build de production embarquant l'API factice échoue au démarrage plutôt que
 * de servir des comptes de démonstration à de vrais utilisateurs.
 */
export const USE_FAKE_API = import.meta.env.VITE_FAKE_API === 'true'

if (USE_FAKE_API && import.meta.env.PROD) {
  throw new Error(
    'VITE_FAKE_API=true dans un build de production. Retirer ce drapeau avant de déployer.',
  )
}

export const api = {
  auth: USE_FAKE_API ? fakeAuthEndpoints : authEndpoints(apiClient),
  products: USE_FAKE_API
    ? { ...fakeProductEndpoints, ...fakeProductMutations, ...fakeVariantMutations }
    : productsEndpoints(apiClient),

  // TODO(#6): endpoints réels commandes et analytics — le contrat est déjà figé
  // dans @shopnest/contracts, seule cette ligne changera.
  orders: fakeOrderEndpoints,
  analytics: fakeAnalyticsEndpoints,
  customers: fakeCustomerEndpoints,
  categories: fakeCategoryCrudEndpoints,
}

/**
 * doc/07 §3.1 — permet d'écrire `<Dropdown source={{ entity: 'categories' }} />`
 * sans que le composant connaisse le détail HTTP.
 *
 * En mode factice, seule cette fonction change : les composants et les écrans
 * qui la consomment sont strictement identiques dans les deux modes.
 */
export const entityResolver: (
  entity: string,
  params?: Record<string, unknown>,
) => FetchOptionsFn = USE_FAKE_API
  ? (entity) => {
      if (entity !== 'categories') {
        throw new Error(`[fake] entité non gérée en mode démonstration : ${entity}`)
      }
      return ({ search }) => fakeCategoryEndpoints.listOptions(search)
    }
  : createEntityResolver(apiClient)
