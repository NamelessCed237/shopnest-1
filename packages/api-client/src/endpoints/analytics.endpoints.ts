import type {
  DashboardRange,
  DashboardSummary,
  LowStockProduct,
  Order,
  StatisticsSummary,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function analyticsEndpoints(client: ApiClient) {
  return {
    /**
     * Les variations sont calculées PAR LE SERVEUR (`revenueDelta`, etc.) :
     * deux clients ne doivent pas pouvoir afficher deux évolutions différentes
     * pour la même donnée.
     */
    dashboard: (range: DashboardRange, options?: RequestOptions) =>
      client.get<DashboardSummary>('/analytics/dashboard', { range }, options),

    /** Ventilations de l'écran statistiques — même fenêtre que le tableau de bord. */
    statistics: (range: DashboardRange, options?: RequestOptions) =>
      client.get<StatisticsSummary>('/analytics/statistics', { range }, options),

    recentOrders: (limit = 6, options?: RequestOptions) =>
      client.get<Order[]>('/analytics/recent-orders', { limit }, options),

    lowStockProducts: (limit = 5, options?: RequestOptions) =>
      client.get<LowStockProduct[]>('/analytics/low-stock', { limit }, options),
  }
}
