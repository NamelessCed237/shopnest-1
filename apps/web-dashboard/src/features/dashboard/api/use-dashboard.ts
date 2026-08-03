import { useQuery } from '@tanstack/react-query'
import { analyticsKeys, orderKeys, productKeys } from '@shopnest/api-client'
import type { AppError, DashboardRange, DashboardSummary, Order, Product } from '@shopnest/contracts'
import { api } from '@/lib/api'

export function useDashboardSummary(range: DashboardRange) {
  return useQuery<DashboardSummary, AppError>({
    queryKey: analyticsKeys.dashboard(range),
    queryFn: () => api.analytics.dashboard(range),
    // Les agrégats bougent lentement : inutile de recharger à chaque retour
    // d'onglet, cela coûterait une requête analytique pour rien.
    staleTime: 5 * 60_000,
  })
}

export function useRecentOrders() {
  return useQuery<Order[], AppError>({
    queryKey: [...orderKeys.all, 'recent'],
    queryFn: () => api.analytics.recentOrders(6),
    staleTime: 60_000,
  })
}

export function useLowStockProducts() {
  return useQuery<Product[], AppError>({
    queryKey: [...productKeys.all, 'low-stock'],
    queryFn: () => api.analytics.lowStockProducts(5),
    staleTime: 60_000,
  })
}
