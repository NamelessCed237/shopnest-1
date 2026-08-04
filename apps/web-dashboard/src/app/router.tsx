import { lazy } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { useSessionStore } from '@/features/auth'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from './routes/login.route'
import { LandingPage } from './routes/landing.route'
import {
  LoginSearchSchema,
  OrdersSearchSchema,
  CustomersSearchSchema,
  OverviewSearchSchema,
  ProductsSearchSchema,
} from './search-schemas'

const rootRoute = createRootRoute({ component: Outlet })

/**
 * Accueil PUBLIC. Un visiteur connecte est renvoye vers son tableau de bord :
 * lui reservir la page marketing a chaque ouverture serait un detour inutile.
 */
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
  beforeLoad: () => {
    if (useSessionStore.getState().status === 'authenticated') {
      throw redirect({ to: '/dashboard' })
    }
  },
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  validateSearch: LoginSearchSchema,
  beforeLoad: () => {
    // Déjà connecté : on ne réaffiche pas le formulaire.
    if (useSessionStore.getState().status === 'authenticated') {
      throw redirect({ to: '/dashboard' })
    }
  },
})

/**
 * doc/04 §6 — la garde d'authentification vit dans `beforeLoad`, pas dans un
 * composant. Un composant qui redirige a déjà monté l'écran protégé, et son
 * chargement de données a déjà pu partir.
 */
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ location }) => {
    if (useSessionStore.getState().status !== 'authenticated') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AppShell,
})

/**
 * doc/04 §6 — chargement paresseux systématique : le bundle de l'écran de
 * connexion ne porte ni le graphique, ni les tableaux.
 */
const lazyRoute = <T extends string>(loader: () => Promise<Record<T, React.ComponentType>>, key: T) =>
  lazy(() => loader().then((module) => ({ default: module[key] })))

const OverviewPage = lazyRoute(() => import('./routes/overview.route'), 'OverviewPage')
const ProductsPage = lazyRoute(() => import('./routes/products.route'), 'ProductsPage')
const ProductCreatePage = lazyRoute(() => import('./routes/product-form.route'), 'ProductCreatePage')
const ProductEditPage = lazyRoute(() => import('./routes/product-form.route'), 'ProductEditPage')
const CategoriesPage = lazyRoute(() => import('./routes/categories.route'), 'CategoriesPage')
const OrdersPage = lazyRoute(() => import('./routes/orders.route'), 'OrdersPage')
const CustomersPage = lazyRoute(() => import('./routes/customers.route'), 'CustomersPage')
const OrderDetailPage = lazyRoute(() => import('./routes/order-detail.route'), 'OrderDetailPage')
const CustomerDetailPage = lazyRoute(
  () => import('./routes/customer-detail.route'),
  'CustomerDetailPage',
)
const StatisticsPage = lazyRoute(() => import('./routes/statistics.route'), 'StatisticsPage')
const BillingPage = lazyRoute(() => import('./routes/billing.route'), 'BillingPage')
const SettingsPage = lazyRoute(() => import('./routes/settings.route'), 'SettingsPage')

const overviewRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dashboard',
  validateSearch: OverviewSearchSchema,
  component: OverviewPage,
})

const productsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/products',
  validateSearch: ProductsSearchSchema,
  component: ProductsPage,
})

const productCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/products/new',
  component: ProductCreatePage,
})

const productEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/products/$productId',
  component: ProductEditPage,
})

const categoriesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/categories',
  component: CategoriesPage,
})

const ordersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/orders',
  validateSearch: OrdersSearchSchema,
  component: OrdersPage,
})

const customersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/customers',
  validateSearch: CustomersSearchSchema,
  component: CustomersPage,
})

const orderDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/orders/$orderId',
  component: OrderDetailPage,
})

const customerDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/customers/$customerId',
  component: CustomerDetailPage,
})

/**
 * La période est validée par `OverviewSearchSchema`, réutilisé tel quel : cet
 * écran commande la même fenêtre que le tableau de bord, et un second schéma
 * identique finirait par diverger d'une valeur près.
 */
const statisticsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/statistics',
  validateSearch: OverviewSearchSchema,
  component: StatisticsPage,
})

const billingRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/billing',
  component: BillingPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  authenticatedRoute.addChildren([
    overviewRoute,
    productsRoute,
    productCreateRoute,
    productEditRoute,
    categoriesRoute,
    ordersRoute,
    customersRoute,
    customerDetailRoute,
    orderDetailRoute,
    statisticsRoute,
    billingRoute,
    settingsRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
