import type { FetchOptionsFn } from '@shopnest/contracts'
import {
  analyticsEndpoints,
  authEndpoints,
  billingEndpoints,
  categoriesEndpoints,
  createApiClient,
  createEntityResolver,
  customersEndpoints,
  ordersEndpoints,
  productsEndpoints,
  settingsEndpoints,
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

  /**
   * Dashboard vendeur : le tenant vient du sous-domaine — `alpha.shopnest.app`.
   *
   * En développement l'application est servie sur `localhost`, qui n'en a pas.
   * `VITE_DEV_TENANT` tient lieu de sous-domaine : sans lui l'API répond
   * « tenant context missing » dès l'écran de connexion, puisqu'un identifiant
   * n'est unique QUE dans sa boutique. Le backend n'accepte l'en-tête
   * correspondant qu'en dehors de la production.
   */
  getTenantId: () => {
    const [sub] = window.location.hostname.split('.')
    if (sub && sub !== 'localhost' && sub !== '127') return sub
    return import.meta.env.VITE_DEV_TENANT || undefined
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
 * Bascule API réelle / API factice, DOMAINE PAR DOMAINE.
 *
 * Un drapeau global ne convient plus : le backend expose aujourd'hui `auth` et
 * `products`, pas encore les commandes, les clients, les catégories ni les
 * statistiques (voir doc/09 §11). Un simple `VITE_FAKE_API=false` casserait
 * donc quatre écrans sur six.
 *
 * `VITE_LIVE_DOMAINS` liste les domaines déjà branchés sur Supabase. Chaque
 * module backend livré ajoute son nom à la liste — et rien d'autre ne change
 * dans l'application, puisque les écrans sont écrits contre les contrats.
 *
 *   VITE_LIVE_DOMAINS=auth,products
 */
const LIVE_DOMAINS = new Set(
  (import.meta.env.VITE_LIVE_DOMAINS ?? '')
    .split(',')
    .map((domain: string) => domain.trim())
    .filter(Boolean),
)

const isLive = (domain: string) => LIVE_DOMAINS.has(domain)

/**
 * Un écran qui doit signaler « données factices » interroge SON domaine, pas
 * l'état global : la bannière de connexion listait encore des comptes de
 * démonstration alors que l'authentification était déjà branchée sur Supabase —
 * elle invitait à saisir des identifiants qui n'existent plus.
 */
export const isFakeDomain = (domain: string) => !isLive(domain)

/** Vrai tant qu'AU MOINS un domaine tourne encore sur des données factices. */
export const USE_FAKE_API = ['auth', 'products', 'orders', 'customers', 'categories', 'analytics'].some(
  (domain) => !isLive(domain),
)

if (USE_FAKE_API && import.meta.env.PROD) {
  throw new Error(
    "Des domaines tournent encore sur l'API factice dans un build de production. " +
      'Compléter VITE_LIVE_DOMAINS avant de déployer.',
  )
}

export const api = {
  auth: isLive('auth') ? authEndpoints(apiClient) : fakeAuthEndpoints,
  products: isLive('products')
    ? productsEndpoints(apiClient)
    : { ...fakeProductEndpoints, ...fakeProductMutations, ...fakeVariantMutations },

  orders: isLive('orders') ? ordersEndpoints(apiClient) : fakeOrderEndpoints,
  analytics: isLive('analytics') ? analyticsEndpoints(apiClient) : fakeAnalyticsEndpoints,
  customers: isLive('customers') ? customersEndpoints(apiClient) : fakeCustomerEndpoints,
  categories: isLive('categories') ? categoriesEndpoints(apiClient) : fakeCategoryCrudEndpoints,

  /**
   * Facturation et paramètres n'ont PAS d'équivalent factice.
   *
   * Ils décrivent la boutique elle-même — plan, quotas, commissions, domaine —
   * pas son catalogue. Une version simulée n'apprendrait rien et donnerait de
   * faux chiffres de facturation, ce qui est pire que pas de chiffres du tout.
   * Ces deux écrans exigent donc une vraie API.
   */
  billing: billingEndpoints(apiClient),
  settings: settingsEndpoints(apiClient),
}

/**
 * doc/07 §3.1 — permet d'écrire `<Dropdown source={{ entity: 'categories' }} />`
 * sans que le composant connaisse le détail HTTP.
 *
 * En mode factice, seule cette fonction change : les composants et les écrans
 * qui la consomment sont strictement identiques dans les deux modes.
 */
const liveEntityResolver = createEntityResolver(apiClient)

export const entityResolver: (
  entity: string,
  params?: Record<string, unknown>,
) => FetchOptionsFn = (entity, params) => {
  // Résolution PAR ENTITÉ et non par drapeau global : les catégories peuvent
  // encore être factices pendant que les produits sont déjà servis par l'API.
  if (isLive(entity)) return liveEntityResolver(entity, params)

  if (entity !== 'categories') {
    throw new Error(`[fake] entité non gérée en mode démonstration : ${entity}`)
  }
  return ({ search }) => fakeCategoryEndpoints.listOptions(search)
}
