import { lazy } from 'react'
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { PLAN_CODES, TENANT_STATUS } from '@shopnest/contracts'
import { AdminShell } from '@/components/layout/AdminShell'
import { useSessionStore } from '@/features/auth'
import { AdminLoginPage } from './routes/login.route'

const rootRoute = createRootRoute({ component: Outlet })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: AdminLoginPage,
  beforeLoad: () => {
    if (useSessionStore.getState().status === 'authenticated') throw redirect({ to: '/' })
  },
})

/**
 * doc/04 §6 — la garde d'authentification vit dans `beforeLoad`, pas dans un
 * composant : un composant qui redirige a déjà monté l'écran protégé, et son
 * chargement de données a déjà pu partir.
 */
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: () => {
    if (useSessionStore.getState().status !== 'authenticated') throw redirect({ to: '/login' })
  },
  component: AdminShell,
})

const lazyRoute = <T extends string>(
  loader: () => Promise<Record<T, React.ComponentType>>,
  key: T,
) => lazy(() => loader().then((module) => ({ default: module[key] })))

const AdminOverviewPage = lazyRoute(() => import('./routes/overview.route'), 'AdminOverviewPage')
const TenantsPage = lazyRoute(() => import('./routes/tenants.route'), 'TenantsPage')
const TenantDetailPage = lazyRoute(
  () => import('./routes/tenant-detail.route'),
  'TenantDetailPage',
)

/** Filtres validés à l'entrée : une URL bricolée ne fait pas planter l'écran. */
const TenantsSearchSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(TENANT_STATUS).optional(),
  planCode: z.enum(PLAN_CODES).optional(),
})

const overviewRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: AdminOverviewPage,
})

const tenantsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/tenants',
  validateSearch: TenantsSearchSchema,
  component: TenantsPage,
})

const tenantDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/tenants/$tenantId',
  component: TenantDetailPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([overviewRoute, tenantsRoute, tenantDetailRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
