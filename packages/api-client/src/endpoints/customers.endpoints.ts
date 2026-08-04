import type {
  CursorPage,
  CustomerSegment,
  CustomerSummary,
  ListCustomersQuery,
  Order,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function customersEndpoints(client: ApiClient) {
  return {
    list: (query: Partial<ListCustomersQuery>, options?: RequestOptions) =>
      client.get<CursorPage<CustomerSummary>>('/customers', query, options),

    detail: (id: string, options?: RequestOptions) =>
      client.get<CustomerSummary>(`/customers/${id}`, undefined, options),

    /** Historique d'achats — mêmes commandes, même forme que l'écran dédié. */
    orders: (
      id: string,
      query: { cursor?: string; limit?: number } = {},
      options?: RequestOptions,
    ) => client.get<CursorPage<Order>>(`/customers/${id}/orders`, query, options),

    /**
     * Répartition par segment.
     *
     * Une route dédiée plutôt qu'un comptage côté client : la liste est
     * paginée, compter les segments sur la page affichée donnerait des tuiles
     * qui changent quand on charge la page suivante.
     */
    segmentCounts: (options?: RequestOptions) =>
      client.get<Record<CustomerSegment, number>>('/customers/segments', undefined, options),
  }
}
