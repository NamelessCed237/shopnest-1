import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { useSessionStore } from '@/features/auth'
import { LoginPage } from './routes/login.route'
import { DashboardPage } from './routes/dashboard.route'

const rootRoute = createRootRoute({ component: Outlet })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: () => {
    // Déjà connecté : on ne réaffiche pas le formulaire.
    if (useSessionStore.getState().status === 'authenticated') {
      throw redirect({ to: '/' })
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
  component: Outlet,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: DashboardPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([dashboardRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
